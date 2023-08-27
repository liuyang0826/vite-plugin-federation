import { satisfy } from '@liuyang0826/vite-plugin-federation/satisfy'
import { unwrapDefault } from '__federation_utils'

// eslint-disable-next-line no-undef
const moduleMap = __rf_var__moduleMap
const moduleCache = Object.create(null)
async function importShared(name, shareScope) {
  return moduleCache[name]
    ? new Promise((r) => r(moduleCache[name]))
    : (await getSharedFromRuntime(name, shareScope)) || getSharedFromLocal(name)
}
// eslint-disable-next-line
async function __federation_import(name) {
  return unwrapDefault(await import(/* @vite-ignore */ name))
}
async function getSharedFromRuntime(name, shareScope) {
  let module = null
  if (globalThis?.__federation_shared__?.[shareScope]?.[name]) {
    const versionObj = globalThis.__federation_shared__[shareScope][name]
    const versionKey = Object.keys(versionObj)[0]
    const versionValue = Object.values(versionObj)[0]
    if (moduleMap[name]?.requiredVersion) {
      // judge version satisfy
      if (satisfy(versionKey, moduleMap[name].requiredVersion)) {
        module = await (await versionValue.get())()
      } else {
        console.log(
          `provider support ${name}(${versionKey}) is not satisfied requiredVersion(\${moduleMap[name].requiredVersion})`
        )
      }
    } else {
      module = await (await versionValue.get())()
    }
  }
  if (module) {
    moduleCache[name] = module
    return module
  }
}
async function getSharedFromLocal(name) {
  if (moduleMap[name]?.import) {
    let module = await (await moduleMap[name].get())()
    moduleCache[name] = module
    return module
  } else {
    console.error(
      `consumer config import=false,so cant use callback shared module`
    )
  }
}
async function importSharedDev(name, shareScope, get) {
  return moduleCache[name]
    ? new Promise((r) => r(moduleCache[name]))
    : (await getSharedFromRuntime(name, shareScope)) ||
        getSharedFromLocalDev(name, get)
}
async function getSharedFromLocalDev(name, get) {
  if (moduleMap[name]?.import) {
    let module = get()
    moduleCache[name] = module
    return module
  } else {
    console.error(
      `consumer config import=false,so cant use callback shared module`
    )
  }
}

export { importShared, importSharedDev }
