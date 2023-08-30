import { unwrapDefault } from '__federation_utils'
const remotesMap = {
  // remotesMap
}
const loadJS = async (url, fn) => {
  const resolvedUrl = typeof url === 'function' ? await url() : url
  // eslint-disable-next-line no-undef
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.onload = fn
  script.src = resolvedUrl
  // eslint-disable-next-line no-undef
  document.getElementsByTagName('head')[0].appendChild(script)
}

const hostSharedModule = {
  // hostSharedModule
}

const initMap = Object.create(null)

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
      return new Promise((resolve, reject) => {
        const getUrl =
          typeof remote.url === 'function' ? remote.url : () => remote.url
        Promise.resolve(getUrl()).then((url) => {
          import(/* @vite-ignore */ url)
            .then((lib) => {
              if (!remote.inited) {
                lib.init(hostSharedModule)
                remote.lib = lib
                remote.lib.init(hostSharedModule)
                remote.inited = true
              }
              resolve(remote.lib)
            })
            .catch(reject)
        })
      })
    }
  } else {
    return remote.lib
  }
}

function getRemote(
  remoteName,
  componentName,
  promiseExportName = 'context.promiseExportName'
) {
  return ensure(remoteName).then((remote) =>
    remote.get(componentName).then((factory) => {
      const module = factory()
      return Promise.resolve(module[promiseExportName]).then(() =>
        unwrapDefault(module)
      )
    })
  )
}

function setRemote(remoteName, remoteConfig) {
  remotesMap[remoteName] = remoteConfig
}

export { getRemote, setRemote }
