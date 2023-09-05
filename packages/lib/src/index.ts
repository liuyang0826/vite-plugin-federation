import type { Plugin } from 'vite'
import { DEFAULT_DTS, DEFAULT_ENTRY_FILENAME } from './constants'
import {
  parseExposeOptions,
  parseRemoteOptions,
  parseSharedOptions
} from './parseOptions'
import createVirtual from './virtual/createVirtual'
import injectShared from './injectShared'
import transform from './transform'
import resolveVersion from './resolveVersion'
import { emitRemoteEntry, emitDtsJSON } from './emitFiles'
import type { Context, VitePluginFederationOptions } from 'types'
import { defu } from 'defu'
import processEntry from './processEntry'
import devMiddleware from './devMiddleware'
import dtsMiddleware from './dtsMiddleware'
import fetchDeclaration from './fetchDeclaration'
import { isPackageExists } from 'local-pkg'

export default function federation(
  options: VitePluginFederationOptions
): Plugin[] {
  let existsTypescript: boolean | null = null
  let remoteRegExps: RegExp[] | null = null
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
    },
    get remoteRegExps() {
      if (remoteRegExps === null) {
        remoteRegExps = context.remote.map(
          (item) => new RegExp(`^${item[0]}/.+?`)
        )
      }
      return remoteRegExps
    },
    shareScope: options.shareScope ?? 'default'
  } as Context

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
          .concat(
            context.shared
              .filter((item) => item[0] !== item[1].packagePath)
              .map((item) => item[0])
          )

        return defu(config, {
          optimizeDeps: {
            exclude: exclude
          }
        })
      },
      async configureServer(server) {
        // get moduleGraph for dev mode dynamic reference
        context.viteDevServer = server
        server.middlewares.use(devMiddleware(context))
        if (context.expose.length) {
          const dts = await dtsMiddleware(context)
          dts && server.middlewares.use(dts)
        }
        if (context.remote.length && context.existsTypescript) {
          const printUrls = server.printUrls
          server.printUrls = function () {
            printUrls.call(this)
            fetchDeclaration(context, server)
          }
        }
      }
    },
    {
      name: 'federation:build',
      enforce: 'post',
      async buildStart() {
        virtual = createVirtual(context)
        await resolveVersion.call(this, context)
        if (!context.viteDevServer && context.expose.length) {
          emitRemoteEntry.call(this, context)
        }
      },
      transform(code, id) {
        if (id === '\0virtual:__federation_shared') {
          return injectShared.call(this, context, code)
        }
        if (code.startsWith(`export default "__VITE_ASSET__`)) {
          return code.replace(
            /export default "(.+)"/,
            (_, content) =>
              `import { assetsURL } from "__federation_shared"\nexport default assetsURL("${content}", import.meta.url)`
          )
        }
        return transform.call(this, context, code, id)
      },
      async generateBundle(_, bundle) {
        processEntry.call(this, context, bundle)
        if (context.existsTypescript) {
          await emitDtsJSON.call(this, context)
        }
      }
    }
  ]
}
