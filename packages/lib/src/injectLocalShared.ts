import type { TransformPluginContext } from 'rollup'
import type { Context } from 'types'
import { basename } from 'node:path'
import { str } from './utils'

export default function injectLocalShared(
  this: TransformPluginContext,
  context: Context,
  code: string
) {
  const localSharedModuleCode = context.shared
    .filter((shareInfo) => shareInfo[1].generate)
    .map((sharedInfo) => {
      if (context.viteDevServer) {
        return `'${
          sharedInfo[0]
        }': { get: ()=> async ()=> unwrapDefault(await import(${str(
          sharedInfo[1].packagePath
        )})), import: ${sharedInfo[1].import}${
          sharedInfo[1].requiredVersion
            ? `,requiredVersion:'${sharedInfo[1].requiredVersion}'`
            : ''
        } }`
      }
      return `'${sharedInfo[0]}': { get: ()=> ()=> __federation_import('./${
        sharedInfo[1].root ? `${sharedInfo[1].root[0]}/` : ''
      }${basename(this.getFileName(sharedInfo[1].emitFile))}'),import:${
        sharedInfo[1].import
      }${
        sharedInfo[1].requiredVersion
          ? `,requiredVersion:'${sharedInfo[1].requiredVersion}'`
          : ''
      }}`
    })

  return localSharedModuleCode.length
    ? code.replace(
        '// localSharedModule',
        `${localSharedModuleCode.join(',\n    ')}`
      )
    : code
}
