import type { Plugin } from 'vite'
import { DEFAULT_DTS, DEFAULT_ENTRY_FILENAME } from './constants'
import {
  parseExposeOptions,
  parseRemoteOptions,
  parseSharedOptions
} from './parseOptions'
import { Remote } from './utils'
import createVirtual from './virtual/createVirtual'
import injectHostShared from './injectHostShared'
import injectLocalShared from './injectLocalShared'
import transform from './transform'
import resolveVersion from './resolveVersion'
import emitFiles from './emitFiles'
import type { Context, VitePluginFederationOptions } from 'types'
import { defu } from 'defu'
import optimizeDepsPlugin from './optimizeDepsPlugin'
import processEntry from './processEntry'
import devMiddleware from './devMiddleware'
import dtsMiddleware from './dtsMiddleware'
import fetchDeclaration from './fetchDeclaration'
import { isPackageExists } from 'local-pkg'
import dtsBuilder from './dtsBuilder'
import { extname } from 'node:path'

export default function federation(
  options: VitePluginFederationOptions
): Plugin[] {
  let existsTypescript: boolean | null = null
  const context = {
    expose: parseExposeOptions(options),
    shared: parseSharedOptions(options),
    remote: parseRemoteOptions(options),
    get assetsDir() {
      return this.viteConfig?.build.assetsDir
    },
    filename: options.filename ?? DEFAULT_ENTRY_FILENAME,
    dts: options.filename ?? DEFAULT_DTS,
    get existsTypescript() {
      if (existsTypescript === null) {
        existsTypescript = isPackageExists('typescript')
      }
      return existsTypescript
    }
  } as Context

  context.isHost = !!context.remote.length && !context.expose.length
  context.isRemote = !!context.expose.length
  context.isShared = !!context.shared.length
  context.hasRemote = !!context.remote.length

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
      configResolved(config) {
        // only run when builder is vite,rollup doesnt has hook named `configResolved`
        context.viteConfig = config
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
          .map((item) => item[0])
          .concat('__federation_shared')
        const plugins: any[] = []
        let needsInterop: string[] = []
        if (context.isRemote && context.isShared) {
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
      async configureServer(server) {
        // get moduleGraph for dev mode dynamic reference
        context.viteDevServer = server
        server.middlewares.use(devMiddleware(context))
        if (context.isRemote) {
          const dts = await dtsMiddleware(context)
          dts && server.middlewares.use(dts)
        }
        if (context.hasRemote && context.existsTypescript) {
          fetchDeclaration(context)
        }
      }
    },
    {
      name: 'federation:build',
      enforce: 'post',
      async buildStart() {
        virtual = createVirtual(context, remotes)
        if (context.hasRemote) {
          await resolveVersion.call(this, context)
        }
        if (!context.viteDevServer) {
          emitFiles.call(this, context)
        }
      },
      transform(code, id) {
        if (context.isShared) {
          if (
            (context.isHost || context.isRemote) &&
            id === '\0virtual:__federation_shared'
          ) {
            return injectLocalShared.call(this, context, code)
          }
          if (id === '\0virtual:__federation_host') {
            return injectHostShared.call(this, context, code)
          }
        }
        if (code.startsWith(`export default "__VITE_ASSET__`)) {
          return code.replace(
            /export default "(.+)"/,
            (_, content) =>
              `import { assetsURL } from "__federation_utils"\nexport default assetsURL("${content}", import.meta.url)`
          )
        }
        if (context.isHost || context.isRemote) {
          return transform.call(this, context, code, remotes, id)
        }
      },
      async generateBundle(_, bundle) {
        processEntry.call(this, context, bundle)

        if (context.existsTypescript) {
          const source = await dtsBuilder(context)
          this.emitFile({
            type: 'asset',
            source: source,
            fileName: `${
              context.assetsDir ? context.assetsDir + '/' : ''
            }${context.filename.replace(extname(context.filename), '.d.json')}`
          })
        }
      }
    }
  ]
}
