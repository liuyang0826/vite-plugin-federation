import type { OutputBundle, OutputChunk, PluginContext } from 'rollup'
import { extname } from 'node:path'
import { str } from './utils'
import { Context } from 'types'

const preloadMarkerWithQuote = /(["'])__VITE_PRELOAD__\1/g

export default function processEntry(
  this: PluginContext,
  context: Context,
  bundle: OutputBundle
) {
  let remoteEntryChunk: OutputChunk | null = null

  for (const file in bundle) {
    const chunk = bundle[file] as OutputChunk
    if (chunk?.facadeModuleId === '\0virtual:__federation_remote') {
      remoteEntryChunk = chunk
      break
    }
  }

  if (!remoteEntryChunk) return

  // when build.cssCodeSplit: false, all files are aggregated into style.xxxxxxxx.css
  if (!context.viteConfig.build.cssCodeSplit) {
    const cssfile = Object.values(bundle).find(
      (chunk) => extname(chunk.fileName) === '.css'
    )?.fileName

    if (cssfile) {
      remoteEntryChunk.code = remoteEntryChunk.code.replace(
        preloadMarkerWithQuote,
        (content) => {
          return `${content}.concat([${str(cssfile)}])`
        }
      )
    }
  }

  if (
    /(import\([^)]+\))\.then\((\S+?)\s*=>\s*([^\s)]+?)\)/.test(
      remoteEntryChunk.code
    )
  ) {
    remoteEntryChunk.code = remoteEntryChunk.code.replace(
      /(import\([^)]+\))\.then\((\S+?)\s*=>\s*([^\s)]+?)\)/g,
      (_, a, b, c) => {
        return `${a}.then(${b} => (Promise.resolve(${b}[${str(
          context.promiseExportName
        )}]).then(()=>()=>${c}.default)))`
      }
    )
  } else {
    remoteEntryChunk.code = remoteEntryChunk.code.replace(
      /import\([^)]+?\)/g,
      (str2) =>
        `${str2}.then(n=>Promise.resolve(n[${str(
          context.promiseExportName
        )}]).then(()=>()=>n.default))`
    )
  }
}
