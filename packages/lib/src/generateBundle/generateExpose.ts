import type {
  AcornNode,
  OutputAsset,
  OutputBundle,
  OutputChunk,
  PluginContext
} from 'rollup'
import type { Context } from 'types'
import { basename, dirname, extname, parse, relative } from 'node:path'
import { DYNAMIC_LOADING_CSS_PREFIX } from '../constants'
import MagicString from 'magic-string'
import { walk } from 'estree-walker'

export default function generateExpose(
  this: PluginContext,
  context: Context,
  bundle: OutputBundle
) {
  // replace import absolute path to chunk's fileName in remoteEntry.js
  let remoteEntryChunk: OutputChunk | null = null
  for (const file in bundle) {
    const chunk = bundle[file] as OutputChunk
    if (chunk?.facadeModuleId === '\0virtual:__federation_remote') {
      remoteEntryChunk = chunk
      break
    }
  }
  // placeholder replace
  if (remoteEntryChunk) {
    const filepathMap = new Map()
    const getFilename = (name) => parse(parse(name).name).name
    const cssBundlesMap: Map<string, OutputAsset | OutputChunk> = Object.keys(
      bundle
    )
      .filter((name) => extname(name) === '.css')
      .reduce((res, name) => {
        const filename = getFilename(name)
        res.set(filename, bundle[name])
        return res
      }, new Map())
    remoteEntryChunk.code = remoteEntryChunk.code.replace(
      new RegExp(`(["'])${DYNAMIC_LOADING_CSS_PREFIX}.*?\\1`, 'g'),
      (str) => {
        // when build.cssCodeSplit: false, all files are aggregated into style.xxxxxxxx.css
        if (context.viteConfig && !context.viteConfig.build.cssCodeSplit) {
          if (cssBundlesMap.size) {
            return `[${[...cssBundlesMap.values()]
              .map((cssBundle) => JSON.stringify(basename(cssBundle.fileName)))
              .join(',')}]`
          } else {
            return '[]'
          }
        }
        const filepath = str.slice(
          (`'` + DYNAMIC_LOADING_CSS_PREFIX).length,
          -1
        )
        if (!filepath || !filepath.length) return str
        let fileBundle = filepathMap.get(filepath)
        if (!fileBundle) {
          fileBundle = Object.values(bundle).find(
            (b) => 'facadeModuleId' in b && b.facadeModuleId === filepath
          )
          if (fileBundle) filepathMap.set(filepath, fileBundle)
          else return str
        }
        const depCssFiles: Set<string> = new Set()
        const addDepCss = (bundleName) => {
          const theBundle = bundle[bundleName] as any
          if (theBundle && theBundle.viteMetadata) {
            for (const cssFileName of theBundle.viteMetadata.importedCss.values()) {
              const cssBundle = cssBundlesMap.get(getFilename(cssFileName))
              if (cssBundle) {
                depCssFiles.add(cssBundle.fileName)
              }
            }
          }
          if (theBundle && theBundle.imports && theBundle.imports.length) {
            theBundle.imports.forEach((name) => addDepCss(name))
          }
        }

        ;[fileBundle.fileName, ...fileBundle.imports].forEach(addDepCss)

        return `[${[...depCssFiles]
          .map((d) => JSON.stringify(basename(d)))
          .join(',')}]`
      }
    )

    // replace the export file placeholder path to final chunk path
    for (const expose of context.expose) {
      const module = Object.keys(bundle).find((module) => {
        const chunk = bundle[module]
        return chunk.name === context.exposesKeyMap.get(expose[0])
      })

      if (module) {
        const chunk = bundle[module]
        const fileRelativePath = relative(
          dirname(remoteEntryChunk.fileName),
          chunk.fileName
        )
        const slashPath = fileRelativePath.replace(/\\/g, '/')
        remoteEntryChunk.code = remoteEntryChunk.code.replace(
          `\${__federation_expose_${expose[0]}}`,
          `./${slashPath}`
        )
      }
    }

    // remove all __f__dynamic_loading_css__ after replace
    let ast: AcornNode | null = null
    try {
      ast = this.parse(remoteEntryChunk.code)
    } catch (err) {
      console.error(err)
    }
    if (!ast) {
      return
    }
    const magicString = new MagicString(remoteEntryChunk.code)
    // let cssFunctionName: string = DYNAMIC_LOADING_CSS
    walk(ast, {
      enter(node: any) {
        if (
          node &&
          node.type === 'CallExpression' &&
          typeof node.arguments[0]?.value === 'string' &&
          node.arguments[0]?.value.indexOf(`${DYNAMIC_LOADING_CSS_PREFIX}`) > -1
        ) {
          magicString.remove(node.start, node.end + 1)
        }
      }
    })
    remoteEntryChunk.code = magicString.toString()
  }
}
