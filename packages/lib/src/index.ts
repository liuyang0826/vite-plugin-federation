import type { Plugin } from 'vite'
import { DEFAULT_ENTRY_FILENAME, OPTIMIZE_SHARED_SUFFIX } from './constants'
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
import { resolveBuildVersion, resolveServeVersion } from './resolveVersion'
import emitFiles from './emitFiles'
import type { Context, VitePluginFederationOptions } from 'types'
import { defu } from 'defu'
import optimizeDepsPlugin from './optimizeDepsPlugin'
import processEntry from './processEntry'
import devMiddleware from './devMiddleware'

export default function federation(
  options: VitePluginFederationOptions
): Plugin[] {
  const context = {
    expose: parseExposeOptions(options),
    shared: parseSharedOptions(options),
    remote: parseRemoteOptions(options),
    get assetsDir() {
      return this.viteConfig?.build.assetsDir
    },
    filename: options.filename ?? DEFAULT_ENTRY_FILENAME
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
        server.middlewares.use(devMiddleware(context))
      }
    },
    {
      name: 'federation:build',
      enforce: 'post',
      async buildStart() {
        virtual = createVirtual(context, remotes)
        if (context.viteDevServer) {
          await resolveServeVersion.call(this, context)
        } else {
          await resolveBuildVersion.call(this, context)
          emitFiles.call(this, context)
        }
      },
      transform(code, id) {
        if (code.startsWith(`export default "__VITE_ASSET__`)) {
          return code.replace(
            /export default "(.+)"/,
            (_, content) =>
              `import { assetsURL } from "__federation_utils"\nexport default assetsURL("${content}", import.meta.url)`
          )
        }
        if (context.isShared) {
          if (
            id === '\0virtual:__federation_shared' &&
            (context.isHost || context.isRemote)
          ) {
            return injectLocalShared.call(this, context, code)
          }
          if (id === '\0virtual:__federation_host') {
            return injectHostShared.call(this, context, code)
          }
        }
        if (context.isHost || context.isRemote) {
          return transform.call(this, context, code, remotes, id)
        }
      },
      generateBundle(_, bundle) {
        processEntry.call(this, context, bundle)
      }
    }
  ]
}
