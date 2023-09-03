import { unwrapDefault } from '__federation_utils'
const remotesMap = {
  // remotesMapCode
}
const loadJS = async (url, fn) => {
  // eslint-disable-next-line no-undef
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.onload = fn
  script.src = url
  // eslint-disable-next-line no-undef
  document.getElementsByTagName('head')[0].appendChild(script)
}

const hostSharedModule = {
  // hostSharedModule
}

async function ensure(remoteId) {
  const remote = remotesMap[remoteId]
  if (!remote.inited) {
    if ('var' === remote.format) {
      // loading js with script tag
      return new Promise((resolve) => {
        const callback = () => {
          if (!remote.inited) {
            // eslint-disable-next-line no-undef
            remote.lib = window[remoteId]
            remote.lib.init(hostSharedModule)
            remote.inited = true
          }
          resolve(remote.lib)
        }
        return loadJS(remote.url, callback)
      })
    } else if (['esm', 'systemjs'].includes(remote.format)) {
      // loading js with import(...)
      return import(/* @vite-ignore */ remote.url).then((lib) => {
        if (!remote.inited) {
          lib.init(hostSharedModule)
          remote.lib = lib
          remote.lib.init(hostSharedModule)
          remote.inited = true
        }
        return remote.lib
      })
    }
  } else {
    return remote.lib
  }
}

const moduleCache = Object.create(null)

async function getRemote(remoteName, componentName) {
  const map = (moduleCache[remoteName] = moduleCache[remoteName] || {})
  if (map[componentName]) return map[componentName]
  const remote = await ensure(remoteName)
  const factory = await remote.get(componentName)
  return (map[componentName] = unwrapDefault(factory()))
}

function setRemote(remoteName, remoteConfig) {
  remotesMap[remoteName] = remoteConfig
}

export { getRemote, setRemote }
