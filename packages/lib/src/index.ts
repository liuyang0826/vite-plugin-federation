import type { Plugin } from 'vite'
import {
  DEFAULT_ENTRY_FILENAME,
  DEFAULT_PROMIESE_EXPORT_NAME,
  OPTIMIZE_SHARED_SUFFIX
} from './constants'
import {
  parseExposeOptions,
  parseRemoteOptions,
  parseSharedOptions
} from './utils/parseOptions'
import { Remote } from './utils'
import createVirtual from './virtual/createVirtual'
import transformVirtualHost from './transforms/transformVirtualHost'
import transformVirtualShared from './transforms/transformVirtualShared'
import transformCode from './transforms/transformCode'
import {
  resolveBuildVersion,
  resolveServeVersion
} from './utils/resolveVersion'
import emitFiles from './utils/emitFiles'
import processExternal from './utils/processExternal'
import generateShared from './generateBundle/generateShared'
import generateExpose from './generateBundle/generateExpose'
import { Context, VitePluginFederationOptions } from 'types'
import { defu } from 'defu'
import optimizeDepsPlugin from './transforms/optimizeDepsPlugin'

export default function federation(
  options: VitePluginFederationOptions
): Plugin[] {
  options.filename = options.filename ?? DEFAULT_ENTRY_FILENAME
  options.promiseExportName =
    options.promiseExportName ?? DEFAULT_PROMIESE_EXPORT_NAME

  const context = {
    expose: parseExposeOptions(options),
    shared: parseSharedOptions(options),
    remote: parseRemoteOptions(options),
    builder: 'rollup',
    get assetsDir() {
      return this.viteConfig.build.assetsDir
    }
  } as Context

  context.isHost = !!context.remote.length && !context.expose.length
  context.isRemote = !!context.expose.length
  context.isShared = !!context.shared.length

  const remotes: Remote[] = []
  for (const item of context.remote) {
    remotes.push({
      id: item[0],
      regexp: new RegExp(`^${item[0]}/.+?`),
      config: item[1]
    })
  }

  let virtual
  return [
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
        context.viteConfig = config
        context.builder = 'vite'
      },
      resolveId(...args) {
        if (args[0] === '~federation') {
          return '\0virtual:__federation_host'
        }
        return virtual.resolveId.call(this, ...args)
      },
      load(...args) {
        return virtual.load.call(this, ...args)
      }
    },
    {
      name: 'federation:serve',
      apply: 'serve',
      config(config) {
        // need to include remotes in the optimizeDeps.exclude
        const exclude = context.remote
          .concat(
            context.shared.filter((item) => item[1].packagePath !== item[0])
          )
          .map((item) => item[0])
          .concat('__federation_shared')
        const plugins: any[] = []
        let needsInterop: string[] = []
        if (context.isRemote && context.isShared) {
          exclude.push(
            ...context.shared.map(
              (item) => `${item[0]}${OPTIMIZE_SHARED_SUFFIX}`
            )
          )
          needsInterop = context.shared.map((item) => item[0])
          plugins.push(optimizeDepsPlugin(context))
        }
        return defu(config, {
          optimizeDeps: {
            exclude: exclude,
            esbuildOptions: { plugins },
            needsInterop: needsInterop
          }
        })
      },
      configureServer(server) {
        // get moduleGraph for dev mode dynamic reference
        context.viteDevServer = server
        server.middlewares.use((req, res, next) => {
          const {
            base,
            build: { assetsDir }
          } = context.viteConfig
          if (req.url !== `${base}${assetsDir}/${options.filename}`)
            return next()

          res.writeHead(302, {
            Location: '/@id/__x00__virtual:__federation_remote',
            'Access-Control-Allow-Origin': '*'
          })
          res.end()
        })
      }
    },
    {
      name: 'federation:build',
      enforce: 'post',
      async buildStart() {
        virtual = createVirtual(context, options, remotes)
        if (context.viteDevServer) {
          await resolveServeVersion.call(this, context)
        } else {
          await resolveBuildVersion.call(this, context)
          emitFiles.call(this, context, options)
        }
      },
      async transform(code, id) {
        if (context.isShared && id === '\0virtual:__federation_shared') {
          return transformVirtualShared.call(this, context, code)
        }
        if (context.isHost && id === '\0virtual:__federation_host') {
          return transformVirtualHost.call(this, context, code)
        }
        if (context.isHost || context.isShared) {
          return transformCode.call(this, context, code, remotes, id)
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
        if (context.isRemote && context.isShared) {
          generateShared(context, bundle)
        }
        generateExpose.call(this, context, bundle)
      }
    }
  ]
}
