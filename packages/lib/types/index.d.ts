/**
 * The following code is adapted from https://github.com/webpack/webpack/types.d.ts
 * MIT License https://github.com/webpack/webpack/LICENSE
 */
import { ResolvedConfig, ViteDevServer, Plugin } from 'vite'

export default function federation(
  options: VitePluginFederationOptions
): Plugin[]

declare interface VitePluginFederationOptions {
  /**
   * Modules that should be exposed by this container. When provided, property name is used as public name, otherwise public name is automatically inferred from request.
   */
  exposes?: Exposes

  /**
   * The filename of the container as relative path inside the `output.path` directory.
   */
  filename?: string

  /**
   * The name of the container.
   */
  name?: string

  /**
   * Container locations and request scopes from which modules should be resolved and loaded at runtime. When provided, property name is used as request scope, otherwise request scope is automatically inferred from container location.
   */
  remotes?: Remotes

  /**
   * The name of the runtime chunk. If set a runtime chunk with this name is created or an existing entrypoint is used as runtime.
   */
  // runtime?: string | false

  /**
   * Share scope name used for all shared modules (defaults to 'default').
   */
  shareScope?: string

  /**
   * Modules that should be shared in the share scope. When provided, property names are used to match requested modules in this compilation.
   */
  shared?: Shared

  /**
   * dts file path
   * @default ./federation.d.ts
   */
  dts?: string
}

type Exposes = ExposesObject[] | ExposesObject

type Remotes = RemotesObject[] | RemotesObject

type Shared = (string | SharedObject)[] | SharedObject

/**
 * Modules that should be exposed by this container. Property names are used as public paths.
 */
declare interface ExposesObject {
  [index: string]: ExposesConfig | string
}

/**
 * Advanced configuration for modules that should be exposed by this container.
 */
declare interface ExposesConfig {
  /**
   * Request to a module that should be exposed by this container.
   */
  import: string

  /**
   * Custom chunk name for the exposed module.
   */
  types?: string
}

/**
 * Container locations from which modules should be resolved and loaded at runtime. Property names are used as request scopes.
 */
declare interface RemotesObject {
  [index: string]: string | RemotesConfig
}

/**
 * Advanced configuration for container locations from which modules should be resolved and loaded at runtime.
 */
declare interface RemotesConfig {
  /**
   * Container locations from which modules should be resolved and loaded at runtime.
   */
  external: string

  /**
   * The name of the share scope shared with this remote.
   */
  shareScope?: string

  /**
   * the remote format
   */
  format?: 'esm' | 'systemjs' | 'var'
}

/**
 * Modules that should be shared in the share scope. Property names are used to match requested modules in this compilation. Relative requests are resolved, module requests are matched unresolved, absolute paths will match resolved requests. A trailing slash will match all requests with this prefix. In this case shareKey must also have a trailing slash.
 */
declare interface SharedObject {
  [index: string]: string | SharedConfig
}

/**
 * Advanced configuration for modules that should be shared in the share scope.
 */
declare interface SharedConfig {
  /**
   * Include the provided and fallback module directly instead behind an async request. This allows to use this shared module in initial load too. All possible shared modules need to be eager too.
   */
  // eager?: boolean

  /**
   * Provided module that should be provided to share scope. Also acts as fallback module if no shared module is found in share scope or version isn't valid. Defaults to the property name.
   */
  import?: boolean

  /**
   * Package name to determine required version from description file. This is only needed when package name can't be automatically determined from request.
   */
  // packageName?: string

  /**
   * Specify the path to the custom package, the field is not supported in dev mode
   */
  packagePath?: string | undefined

  /**
   * Version requirement from module in share scope.
   */
  requiredVersion?: string | false

  /**
   * Module is looked up under this key from the share scope.
   */
  shareKey?: string

  /**
   * Share scope name.
   */
  shareScope?: string

  /**
   * Allow only a single version of the shared module in share scope (disabled by default).
   */
  singleton?: boolean

  /**
   * Do not accept shared module if version is not valid (defaults to yes, if local fallback module is available and shared module is not a singleton, otherwise no, has no effect if there is no required version specified).
   */
  strictVersion?: boolean

  /**
   * Version of the provided module. Will replace lower matching versions, but not higher.
   */
  version?: string | false
}

declare interface Context {
  shared: [string, SharedConfig][]
  expose: [string, ExposesConfig][]
  remote: [string, RemotesConfig][]
  assetsDir?: string
  filename: string
  exposesKeyMap: Map<string, string>
  shareName2Prop: Map<string, any>
  viteConfig?: ResolvedConfig
  viteDevServer: ViteDevServer
  dts: string
  existsTypescript: boolean
  remoteRegExps: RegExp[]
  shareScope: string
}
