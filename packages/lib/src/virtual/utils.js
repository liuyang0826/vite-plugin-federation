export function unwrapDefault(module) {
  if (!module) return module
  const proxy = typeof module.default === 'function' ? module.default : {}
  Object.keys(module)
    .concat(module.default ? Object.keys(module.default) : [])
    .forEach((k) => {
      if (!Object.getOwnPropertyDescriptor(proxy, k)) {
        Object.defineProperty(proxy, k, {
          enumerable: true,
          configurable: true,
          get() {
            return importRef(module, k)
          },
          set(v) {
            try {
              module[k] = v
            } catch {
              module.default[k] = v
            }
          }
        })
      }
    })
  return proxy
}

export function importRef(source, k) {
  return source[k] ?? source.default?.[k]
}

export function assetsURL(url, importer) {
  if (url[0] === '/') {
    return new URL(importer).origin + url
  }
  if (url[0] === '.') {
    return new URL(url, importer).href
  }
  return url
}
