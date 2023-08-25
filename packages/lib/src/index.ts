import type { Plugin } from 'vite'
import {
  DEFAULT_ENTRY_FILENAME,
  DEFAULT_PROMIESE_EXPORT_NAME,
  DEFAULT_TRANSFORM_FILE_TYPES
} from './constants'
import {
  parseExposeOptions,
  parseRemoteOptions,
  parseSharedOptions
} from './utils/parseOptions'
import { Remote } from './utils'
import createVirtual from './virtual/createVirtual'
import transformFederationProd from './transforms/transformFederationProd'
import transformFederationFnImport from './transforms/transformFederationFnImport'
import transfromProduction from './transforms/transfromProduction'
import {
  resolveBuildVersion,
  resolveServeVersion
} from './utils/resolveVersion'
import emitFiles from './utils/emitFiles'
import processExternal from './utils/processExternal'
import generateShared from './generateBundle/generateShared'
import generateExpose from './generateBundle/generateExpose'
import { createFilter } from '@rollup/pluginutils'
import { Context, VitePluginFederationOptions } from 'types'
import transformDevelopmnt from './transforms/transformDevelopmnt'
import { transformFederationDev } from './transforms/transformFederationDev'
import { defu } from 'defu'
export default function federation(
  options: VitePluginFederationOptions
): Plugin[] {
  options.filename = options.filename ?? DEFAULT_ENTRY_FILENAME
  options.promiseExportName =
    options.promiseExportName ?? DEFAULT_PROMIESE_EXPORT_NAME

  const context = {
    expose: parseExposeOptions(options),
    shared: parseSharedOptions(options),
    remote: parseRemoteOptions(options)
  } as Context

  context.isHost = !!(context.remote.length || context.expose.length)
  context.isRemote = !!context.expose.length
  context.isShared = !!context.shared.length
  const filter = createFilter(
    options.transformFileTypes ?? DEFAULT_TRANSFORM_FILE_TYPES
  )

  const remotes: Remote[] = []
  for (const item of context.remote) {
    remotes.push({
      id: item[0],
      regexp: new RegExp(`^${item[0]}/.+?`),
      config: item[1]
    })
  }

  return [
    createVirtual(context, options, remotes),
    {
      name: 'federation:prepare',
      options(_options) {
        if (typeof _options.input === 'string') {
          _options.input = { index: _options.input }
        }
        _options.external = _options.external || []
        if (!Array.isArray(_options.external)) {
          _options.external = [_options.external as string]
        }
        return processExternal(context, _options)
      },
      configResolved(config) {
        // only run when builder is vite,rollup doesnt has hook named `configResolved`
        context.assetsDir = config.build.assetsDir
        context.viteConfigResolved = config
      },
      async resolveId(...args) {
        if (args[0] === '~federation') {
          return '\0virtual:__federation__'
        }
        return null
      }
    },
    {
      name: 'federation:serve',
      enforce: 'post',
      apply: 'serve',
      config(config) {
        // need to include remotes in the optimizeDeps.exclude
        if (context.remote.length) {
          return defu(config, {
            optimizeDeps: {
              exclude: context.remote.map((item) => item[0])
            }
          })
        }
      },
      configureServer(server) {
        // get moduleGraph for dev mode dynamic reference
        context.viteDevServer = server
      },
      async transform(code, id) {
        if (id === '\0virtual:__federation__') {
          return transformFederationDev.call(this, context, code)
        }
        // ignore some not need to handle file types
        if (filter(id)) {
          return await transformDevelopmnt.call(this, code, remotes)
        }
      },
      async buildStart() {
        await resolveServeVersion.call(this, context)
      }
    },
    {
      name: 'federation:build',
      enforce: 'post',
      apply: 'build',
      async buildStart() {
        await resolveBuildVersion.call(this, context)
        emitFiles.call(this, context, options)
      },
      transform(code, id) {
        if (context.isShared && id === '\0virtual:__federation_fn_import') {
          return transformFederationFnImport.call(this, context, code)
        }
        if (context.isHost && id === '\0virtual:__federation__') {
          return transformFederationProd.call(this, context, code)
        }
        if (context.isHost || context.isShared) {
          return transfromProduction.call(this, context, code, remotes, id)
        }
      },
      outputOptions(outputOption) {
        // remove rollup generated empty imports,like import './filename.js'
        outputOption.hoistTransitiveImports = false

        const manualChunkFunc = (id: string) => {
          //  if id is in shared dependencies, return id ,else return vite function value
          const find = context.shared.find((arr) =>
            arr[1].dependencies?.has(id)
          )
          return find ? find[0] : undefined
        }

        // only active when manualChunks is function,array not to solve
        if (typeof outputOption.manualChunks === 'function') {
          outputOption.manualChunks = new Proxy(outputOption.manualChunks, {
            apply(target, _, argArray) {
              const result = manualChunkFunc(argArray[0])
              return result ? result : target(argArray[0], argArray[1])
            }
          })
        }

        // The default manualChunk function is no longer available from vite 2.9.0
        if (outputOption.manualChunks === undefined) {
          outputOption.manualChunks = manualChunkFunc
        }

        return outputOption
      },
      generateBundle(_, bundle) {
        if (context.isRemote) {
          generateShared(context, bundle)
        }
        generateExpose.call(this, context, bundle)
      }
    }
  ]
}
