import type { OutputBundle, OutputChunk, PluginContext } from 'rollup'
import { extname } from 'node:path'
import { str, toRelativePath } from './utils'
import { Context } from 'types'

const preloadMarkerWithQuote = /(["'])__VITE_PRELOAD__\1/g

export default function processEntry(
  this: PluginContext,
  context: Context,
  bundle: OutputBundle
) {
  const ext = extname(context.filename)
  for (const file in bundle) {
    const chunk = bundle[file] as OutputChunk
    if (chunk.facadeModuleId === '\0virtual:__federation_remote') {
      process(file, chunk)
      // for legacy
      chunk.fileName = chunk.fileName.replace(
        /(.*?)_virtual___federation_remote(-.+?)?-.+/,
        (_, prefix, tag) => {
          return (
            prefix + context.filename.slice(0, -ext.length) + (tag || '') + ext
          )
        }
      )
      break
    }
  }

  function process(file: string, chunk: OutputChunk) {
    // when build.cssCodeSplit: false, all files are aggregated into style.xxxxxxxx.css
    if (!context.viteConfig?.build.cssCodeSplit) {
      const cssfile = Object.values(bundle).find(
        (chunk) => extname(chunk.fileName) === '.css'
      )?.fileName

      if (cssfile) {
        const config = context.viteConfig!
        // https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/importAnalysisBuild.ts#L154
        const resolveModulePreloadDependencies =
          config.build.modulePreload &&
          config.build.modulePreload.resolveDependencies
        const renderBuiltUrl = config.experimental.renderBuiltUrl
        const customModulePreloadPaths = !!(
          resolveModulePreloadDependencies || renderBuiltUrl
        )
        const isRelativeBase = config.base === './' || config.base === ''
        const optimizeModulePreloadRelativePaths =
          isRelativeBase && !customModulePreloadPaths
        chunk.code = chunk.code.replace(preloadMarkerWithQuote, (content) => {
          return `${content}.concat([${str(
            optimizeModulePreloadRelativePaths
              ? toRelativePath(cssfile, file)
              : cssfile
          )}])`
        })
      }
    }
  }
}
