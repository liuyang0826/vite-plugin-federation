let moduleMap = {
  // moduleMapCode
}
export const get = (module) => {
  return moduleMap[module]()
}
export const init = (hostSharedModule) => {
  globalThis.__federation_shared__ = globalThis.__federation_shared__ || {}
  Object.entries(hostSharedModule).forEach(([key, value]) => {
    const versionKey = Object.keys(value)[0]
    const versionValue = Object.values(value)[0]
    const scope = versionValue.scope || 'default'
    const shared = (globalThis.__federation_shared__[scope] =
      globalThis.__federation_shared__[scope] || {})
    shared[key] = shared[key] || {}
    if (!shared[key][versionKey]) {
      shared[key][versionKey] = versionValue
    }
  })
}
