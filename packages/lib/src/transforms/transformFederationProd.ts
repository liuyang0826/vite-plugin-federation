import { basename } from 'node:path'
import type { Context } from 'types'
import type { TransformPluginContext } from 'rollup'
import { getModuleMarker } from '../utils'
import { REMOTE_FROM_PARAMETER } from '../constants'

export default function transformFederationProd(
  this: TransformPluginContext,
  context: Context,
  code: string
) {
  const res: string[] = []
  context.shared.forEach((arr) => {
    const obj = arr[1]
    let str = ''
    if (typeof obj === 'object') {
      const fileName = `./${basename(this.getFileName(obj.emitFile))}`
      str += `get: () => get('${fileName}', ${REMOTE_FROM_PARAMETER}), loaded: 1`
      res.push(`'${arr[0]}':{'${obj.version}':{${str}}}`)
    }
  })
  return code.replace(getModuleMarker('shareScope'), res.join(','))
}
