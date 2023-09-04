import { sharedScope, install } from '__federation_shared'
let moduleMap = {
  // moduleMapCode
}
export const get = (module) => {
  return moduleMap[module]()
}

const name = 'shareScopeName'
export const init = (shareScope) => {
  const oldScope = sharedScope[name]
  if (oldScope && oldScope !== shareScope)
    throw new Error(
      'Container initialization failed as it has already been initialized with a different share scope'
    )
  sharedScope[name] = shareScope
  return install(name)
}
