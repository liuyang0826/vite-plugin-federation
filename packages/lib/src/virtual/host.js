import { unwrapDefault } from '__federation_utils'
import { sharedScope, install } from '__federation_shared'
const remotesMap = {
  // remotesMapCode
}
const loadJS = (url, remoteName) => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-undef
    if (window[remoteName]) return resolve(window[remoteName])
    // eslint-disable-next-line no-undef
    const script = document.createElement('script')
    script.type = 'text/javascript'
    // eslint-disable-next-line no-undef
    script.onload = () => resolve(window[remoteName])
    script.onerror = () => reject()
    script.src = url
    // eslint-disable-next-line no-undef
    document.getElementsByTagName('head')[0].appendChild(script)
  })
}

async function ensure(remoteName) {
  const remote = remotesMap[remoteName]
  const scopeName = remote.shareScope ?? 'default'
  install(scopeName)
  if ('var' === remote.format) {
    // loading js with script tag
    return loadJS(remote.external, remoteName).then((lib) => {
      lib.init(sharedScope)
      return lib
    })
  } else if (['esm', 'systemjs'].includes(remote.format)) {
    // loading js with import(...)
    return import(/* @vite-ignore */ remote.external).then((lib) => {
      lib.init(sharedScope)
      return lib
    })
  }
}

async function getRemote(remoteName, componentName) {
  const remote = await ensure(remoteName)
  const factory = await remote.get(componentName)
  return unwrapDefault(factory())
}

function setRemote(remoteName, remoteConfig) {
  remotesMap[remoteName] = remoteConfig
}

export { getRemote, setRemote }
