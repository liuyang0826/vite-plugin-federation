import type { TransformPluginContext } from 'rollup'
import { str } from './utils'
import type { Context } from 'types'

export default async function injectHostShared(
  this: TransformPluginContext,
  context: Context,
  code: string
) {
  const hostSharedModuleCode = context.shared.map((arr) => {
    return `${str(arr[0])}:{ ${str(
      arr[1].version
    )}: { ${`get: () => () => import(${str(
      arr[1].packagePath
    )}), loaded: 1`} } }`
  })

  return hostSharedModuleCode.length
    ? code.replace('// hostSharedModule', hostSharedModuleCode.join(',\n  '))
    : code
}
