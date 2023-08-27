import type { OutputBundle } from 'rollup'
import type { Context } from 'types'
import { sharedFilePathReg } from '../constants'

export default function generateShared(context: Context, bundle: OutputBundle) {
  const needRemoveShared = new Set<string>()
  for (const key in bundle) {
    const chunk = bundle[key]
    if (chunk.type === 'chunk') {
      const regRst = sharedFilePathReg.exec(chunk.fileName)
      if (regRst && context.shareName2Prop.get(regRst[1])?.generate) {
        needRemoveShared.add(key)
      }
    }
  }
  if (needRemoveShared.size !== 0) {
    for (const key of needRemoveShared) {
      delete bundle[key]
    }
  }
}
