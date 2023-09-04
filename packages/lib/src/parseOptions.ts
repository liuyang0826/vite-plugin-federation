import type {
  Exposes,
  Remotes,
  Shared,
  VitePluginFederationOptions
} from 'types'

export function parseSharedOptions(options: VitePluginFederationOptions) {
  return parseOptions(
    options.shared || {},
    (_, key) => ({
      import: true,
      shareScope: options.shareScope,
      packagePath: key,
      generate: true,
      singleton: false,
      strictVersion: true
    }),
    (value, key) => {
      value.import = value.import ?? true
      value.shareScope = value.shareScope || options.shareScope
      value.packagePath = value.packagePath || key
      value.singleton = value.singleton ?? false
      value.strictVersion = value.strictVersion ?? true
      return value
    }
  )
}

export function parseExposeOptions(options: VitePluginFederationOptions) {
  return parseOptions(
    options.exposes,
    (item) => {
      return {
        import: item,
        types: undefined
      }
    },
    (item) => ({
      import: item.import,
      types: item.types || undefined
    })
  )
}

export function parseRemoteOptions(options: VitePluginFederationOptions) {
  return parseOptions(
    options.remotes ? options.remotes : {},
    (item) => ({
      external: item,
      format: 'esm' as const
    }),
    (item) => ({
      external: item.external,
      shareScope: item.shareScope,
      format: item.format || 'esm'
    })
  )
}

type ConfigObject<T> = Exclude<T, any[]> extends {
  [index: string]: infer R
}
  ? R
  : never

type ConfigArray<T> = T extends (infer R)[] ? R[] : never

export function parseOptions<T extends Exposes | Remotes | Shared>(
  options: T | undefined,
  normalizeSimple: (
    value: string,
    key: string
  ) => Exclude<ConfigObject<T>, string>,
  normalizeOptions: (
    value: Exclude<ConfigObject<T>, string>,
    key: string
  ) => Exclude<ConfigObject<T>, string>
) {
  if (!options) {
    return []
  }
  const list: [string, Exclude<ConfigObject<T>, string>][] = []
  const array = (items: ConfigArray<T>) => {
    for (const item of items) {
      if (typeof item === 'string') {
        list.push([item, normalizeSimple(item, item)])
      } else if (typeof item === 'object') {
        object(item as Exclude<T, any[]>)
      } else {
        throw new Error('Unexpected options format')
      }
    }
  }
  const object = (obj: Exclude<T, any[]>) => {
    Object.keys(obj).forEach((key) => {
      const value = obj[key as keyof T]
      if (typeof value === 'string') {
        list.push([key, normalizeSimple(value, key)])
      } else {
        list.push([
          key,
          normalizeOptions(value as Exclude<ConfigObject<T>, string>, key)
        ])
      }
    })
  }
  if (Array.isArray(options)) {
    array(options as unknown as ConfigArray<T>)
  } else if (typeof options === 'object') {
    object(options as Exclude<T, any[]>)
  } else {
    throw new Error('Unexpected options format')
  }
  return list
}
