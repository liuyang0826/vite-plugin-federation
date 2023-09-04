import { unwrapDefault } from '__federation_utils'
import {
  versionLt,
  rangeToString,
  satisfy,
  parseVersion
} from '__federation_semver'

export const sharedScope = Object.create(null)

const sharedProviders = [
  // sharedProvidersCode
]

const installed = {}

export function install(name) {
  if (installed[name]) return
  installed[name] = 1
  if (!sharedScope[name]) sharedScope[name] = {}
  const scope = sharedScope[name]
  sharedProviders.forEach(({ name, version, factory }) => {
    const versions = (scope[name] = scope[name] || {})
    const activeVersion = versions[version]
    if (!activeVersion) versions[version] = { get: factory }
  })
}

const sharedConsumerMap = {
  // sharedConsumerMap
}

const ensureExistence = (scopeName, key) => {
  const scope = sharedScope[scopeName]
  if (!scope)
    throw new Error(
      'Shared module ' + key + " doesn't exist in shared scope " + scopeName
    )
  return scope
}
const findVersion = (scope, key) => {
  const versions = scope[key]
  key = Object.keys(versions).reduce((a, b) => {
    return !a || versionLt(a, b) ? b : a
  }, 0)
  return key && versions[key]
}
const findSingletonVersionKey = (scope, key) => {
  const versions = scope[key]
  return Object.keys(versions).reduce((a, b) => {
    return !a || (!versions[a].loaded && versionLt(a, b)) ? b : a
  }, 0)
}
const getInvalidSingletonVersionMessage = (
  scope,
  key,
  version,
  requiredVersion
) => {
  return (
    'Unsatisfied version ' +
    version +
    ' from ' +
    (version && scope[key][version].from) +
    ' of shared singleton module ' +
    key +
    ' (required ' +
    rangeToString(requiredVersion) +
    ')'
  )
}
const getSingleton = (scope, scopeName, key, requiredVersion) => {
  var version = findSingletonVersionKey(scope, key)
  return get(scope[key][version])
}
const getSingletonVersion = (scope, scopeName, key, requiredVersion) => {
  var version = findSingletonVersionKey(scope, key)
  if (!satisfy(requiredVersion, version))
    typeof console !== 'undefined' &&
      console.warn &&
      console.warn(
        getInvalidSingletonVersionMessage(scope, key, version, requiredVersion)
      )
  return get(scope[key][version])
}
const getStrictSingletonVersion = (scope, scopeName, key, requiredVersion) => {
  const version = findSingletonVersionKey(scope, key)
  if (!satisfy(requiredVersion, version))
    throw new Error(
      getInvalidSingletonVersionMessage(scope, key, version, requiredVersion)
    )
  return get(scope[key][version])
}
const findValidVersion = (scope, key, requiredVersion) => {
  const versions = scope[key]
  key = Object.keys(versions).reduce((a, b) => {
    if (!satisfy(requiredVersion, b)) return a
    return !a || versionLt(a, b) ? b : a
  }, 0)
  return key && versions[key]
}
const getInvalidVersionMessage = (scope, scopeName, key, requiredVersion) => {
  var versions = scope[key]
  return (
    'No satisfying version (' +
    rangeToString(requiredVersion) +
    ') of shared module ' +
    key +
    ' found in shared scope ' +
    scopeName +
    '.\n' +
    'Available versions: ' +
    Object.keys(versions)
      .map((key) => {
        return key + ' from ' + versions[key].from
      })
      .join(', ')
  )
}
const getValidVersion = (scope, scopeName, key, requiredVersion) => {
  var entry = findValidVersion(scope, key, requiredVersion)
  if (entry) return get(entry)
  throw new Error(
    getInvalidVersionMessage(scope, scopeName, key, requiredVersion)
  )
}
const warnInvalidVersion = (scope, scopeName, key, requiredVersion) => {
  typeof console !== 'undefined' &&
    console.warn &&
    console.warn(
      getInvalidVersionMessage(scope, scopeName, key, requiredVersion)
    )
}
const get = async (entry) => {
  entry.loaded = 1
  return unwrapDefault(await entry.get())
}

const init = (fn) => (scopeName, a, b, c) => {
  install(scopeName)
  return fn(scopeName, sharedScope[scopeName], a, b, c)
}

const load = /*#__PURE__*/ init((scopeName, scope, key) => {
  ensureExistence(scopeName, key)
  return get(findVersion(scope, key))
})
const loadFallback = /*#__PURE__*/ init((scopeName, scope, key, fallback) => {
  return scope && scope[key] ? get(findVersion(scope, key)) : fallback()
})
const loadVersionCheck = /*#__PURE__*/ init(
  (scopeName, scope, key, version) => {
    ensureExistence(scopeName, key)
    return get(
      findValidVersion(scope, key, version) ||
        warnInvalidVersion(scope, scopeName, key, version) ||
        findVersion(scope, key)
    )
  }
)
const loadSingleton = /*#__PURE__*/ init((scopeName, scope, key) => {
  ensureExistence(scopeName, key)
  return getSingleton(scope, scopeName, key)
})
const loadSingletonVersionCheck = /*#__PURE__*/ init(
  (scopeName, scope, key, version) => {
    ensureExistence(scopeName, key)
    return getSingletonVersion(scope, scopeName, key, version)
  }
)
const loadStrictVersionCheck = /*#__PURE__*/ init(
  (scopeName, scope, key, version) => {
    ensureExistence(scopeName, key)
    return getValidVersion(scope, scopeName, key, version)
  }
)
const loadStrictSingletonVersionCheck = /*#__PURE__*/ init(
  (scopeName, scope, key, version) => {
    ensureExistence(scopeName, key)
    return getStrictSingletonVersion(scope, scopeName, key, version)
  }
)
const loadVersionCheckFallback = /*#__PURE__*/ init(
  (scopeName, scope, key, version, fallback) => {
    if (!scope || !scope[key]) return fallback()
    return get(
      findValidVersion(scope, key, version) ||
        warnInvalidVersion(scope, scopeName, key, version) ||
        findVersion(scope, key)
    )
  }
)
const loadSingletonFallback = /*#__PURE__*/ init(
  (scopeName, scope, key, fallback) => {
    if (!scope || !scope[key]) return fallback()
    return getSingleton(scope, scopeName, key)
  }
)
const loadSingletonVersionCheckFallback = /*#__PURE__*/ init(
  (scopeName, scope, key, version, fallback) => {
    if (!scope || !scope[key]) return fallback()
    return getSingletonVersion(scope, scopeName, key, version)
  }
)
const loadStrictVersionCheckFallback = /*#__PURE__*/ init(
  (scopeName, scope, key, version, fallback) => {
    const entry = scope && scope[key] && findValidVersion(scope, key, version)
    return entry ? get(entry) : fallback()
  }
)
const loadStrictSingletonVersionCheckFallback = /*#__PURE__*/ init(
  (scopeName, scope, key, version, fallback) => {
    if (!scope || !scope[key]) return fallback()
    return getStrictSingletonVersion(scope, scopeName, key, version)
  }
)

const importShared = (name) => {
  return sharedConsumerMap[name]()
}

function importSharedDev(name, fallback) {
  return sharedConsumerMap[name](fallback)
}

export { importShared, importSharedDev }
