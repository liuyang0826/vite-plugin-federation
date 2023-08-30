import type {
  ConfigTypeSet,
  Exposes,
  Remotes,
  Shared,
  VitePluginFederationOptions
} from 'types'

export function parseSharedOptions(
  options: VitePluginFederationOptions
): (string | ConfigTypeSet)[] {
  return parseOptions(
    options.shared || {},
    (_, key) => ({
      import: true,
      shareScope: 'default',
      packagePath: key,
      generate: true
    }),
    (value, key) => {
      value.import = value.import ?? true
      value.shareScope = value.shareScope || 'default'
      value.packagePath = value.packagePath || key
      value.generate = value.generate ?? true
      return value
    }
  )
}

export function parseExposeOptions(
  options: VitePluginFederationOptions
): (string | ConfigTypeSet)[] {
  return parseOptions(
    options.exposes,
    (item) => {
      return {
        import: item,
        name: undefined
      }
    },
    (item) => ({
      import: item.import,
      name: item.name || undefined
    })
  )
}

export function parseRemoteOptions(
  options: VitePluginFederationOptions
): (string | ConfigTypeSet)[] {
  return parseOptions(
    options.remotes ? options.remotes : {},
    (item) => ({
      external: Array.isArray(item) ? item : [item],
      shareScope: options.shareScope || 'default',
      format: 'esm',
      externalType: 'url',
      promiseExportName: '__tla'
    }),
    (item) => ({
      external: Array.isArray(item.external) ? item.external : [item.external],
      shareScope: item.shareScope || options.shareScope || 'default',
      format: item.format || 'esm',
      externalType: item.externalType || 'url',
      promiseExportName:
        item.promiseExportName || options.promiseExportName || '__tla'
    })
  )
}

export function parseOptions(
  options: Exposes | Remotes | Shared | undefined,
  normalizeSimple: (value: any, key: any) => ConfigTypeSet,
  normalizeOptions: (value: any, key: any) => ConfigTypeSet
): (string | ConfigTypeSet)[] {
  if (!options) {
    return []
  }
  const list: {
    [index: number]: string | ConfigTypeSet
  }[] = []
  const array = (items: (string | ConfigTypeSet)[]) => {
    for (const item of items) {
      if (typeof item === 'string') {
        list.push([item, normalizeSimple(item, item)])
      } else if (item && typeof item === 'object') {
        object(item)
      } else {
        throw new Error('Unexpected options format')
      }
    }
  }
  const object = (obj) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' || Array.isArray(value)) {
        list.push([key, normalizeSimple(value, key)])
      } else {
        list.push([key, normalizeOptions(value, key)])
      }
    }
  }
  if (Array.isArray(options)) {
    array(options)
  } else if (typeof options === 'object') {
    object(options)
  } else {
    throw new Error('Unexpected options format')
  }
  return list
}
