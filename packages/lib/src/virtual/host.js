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

function get(name, REMOTE_FROM_PARAMETER) {
  return __federation_import(name).then((module) => () => {
    if (REMOTE_FROM_PARAMETER === 'webpack') {
      return Object.prototype.toString.call(module).indexOf('Module') > -1 &&
        module.default
        ? module.default
        : module
    }
    return module
  })
}

const wrapShareModule = (REMOTE_FROM_PARAMETER) => {
  return {
    // getModuleMarker('shareScope')
  }
}

async function __federation_import(name) {
  return import(name)
}

const initMap = Object.create(null)

async function ensure(remoteId) {
  // eslint-disable-next-line no-undef
  const remote = remotesMap[remoteId]
  if (!remote.inited) {
    if ('var' === remote.format) {
      // loading js with script tag
      return new Promise((resolve) => {
        const callback = () => {
          if (!remote.inited) {
            // eslint-disable-next-line no-undef
            remote.lib = window[remoteId]
            remote.lib.init(wrapShareModule(remote.from))
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
                const shareScope = wrapShareModule(remote.from)
                lib.init(shareScope)
                remote.lib = lib
                remote.lib.init(shareScope)
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

function unwrapDefault(module) {
  return module?.__esModule || module?.[Symbol.toStringTag] === 'Module'
    ? module.default
    : module
}

function wrapDefault(module, need) {
  if (!module?.default && need) {
    let obj = Object.create(null)
    obj.default = module
    obj.__esModule = true
    return obj
  }
  return module
}

function getRemote(remoteName, componentName) {
  return ensure(remoteName).then((remote) =>
    remote.get(componentName).then((factory) => factory())
  )
}

function setRemote(remoteName, remoteConfig) {
  // eslint-disable-next-line no-undef
  remotesMap[remoteName] = remoteConfig
}

function importRef(source, varName) {
  return source[varName] ?? source.default?.[varName]
}

function wrapRequire(target) {
  if (!target) return target
  const f = target.default
  if (typeof f === 'function') {
    const fn = function fn() {
      if (this instanceof fn) {
        return Reflect.construct(f, arguments, this.constructor)
      }
      return f.apply(this, arguments)
    }
    fn.prototype = f.prototype
    return fn
  }
  const proxy = {}
  new Set([
    ...Object.keys(target),
    ...(target.default ? Object.keys(target.default) : [])
  ]).forEach((k) => {
    Object.defineProperty(proxy, k, {
      enumerable: true,
      get: function () {
        return importRef(target, k)
      }
    })
  })
  return proxy
}

export {
  ensure,
  getRemote,
  setRemote,
  unwrapDefault,
  wrapDefault,
  importRef,
  wrapRequire
}
