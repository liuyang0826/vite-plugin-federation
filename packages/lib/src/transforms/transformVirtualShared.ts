import type { TransformPluginContext } from 'rollup'
import type { Context } from 'types'
import { basename } from 'node:path'
import { getModuleMarker } from '../utils'

export default function transformVirtualShared(
  this: TransformPluginContext,
  context: Context,
  code: string
) {
  const moduleMapCode = context.shared
    .filter((shareInfo) => shareInfo[1].generate)
    .map((sharedInfo) => {
      if (context.viteDevServer) {
        return `'${
          sharedInfo[0]
        }': { get: ()=> async ()=> unwrapDefault(await import(${JSON.stringify(
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
    .join(',')

  return code.replace(getModuleMarker('moduleMap', 'var'), `{${moduleMapCode}}`)
}
