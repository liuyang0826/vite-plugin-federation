import type { TransformPluginContext } from 'rollup'
import type { Context } from 'types'
import { str } from './utils'

export default function injectLocalShared(
  this: TransformPluginContext,
  context: Context,
  code: string
) {
  const localSharedModuleCode = context.shared
    .filter((shareInfo) => shareInfo[1].generate)
    .map((sharedInfo) => {
      return `${str(sharedInfo[0])}: { get: () => () => import(${str(
        sharedInfo[1].packagePath
      )}), import: ${sharedInfo[1].import}${
        sharedInfo[1].requiredVersion
          ? `, requiredVersion: ${str(sharedInfo[1].requiredVersion)}`
          : ''
      } }`
    })

  return localSharedModuleCode.length
    ? code.replace(
        '// localSharedModule',
        `${localSharedModuleCode.join(',\n  ')}`
      )
    : code
}
