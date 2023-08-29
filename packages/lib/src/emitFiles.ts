import type { PluginContext } from 'rollup'
import type { Context } from 'types'
import { removeNonRegLetter } from './utils'
import { NAME_CHAR_REG } from './constants'

export default function emitFiles(this: PluginContext, context: Context) {
  if (context.isRemote) {
    this.emitFile({
      fileName: `${context.assetsDir ? context.assetsDir + '/' : ''}${
        context.filename
      }`,
      type: 'chunk',
      id: '__federation_remote',
      preserveSignature: 'strict'
    })
  }

  if ((context.isHost || context.isRemote) && context.isShared) {
    for (const sharedInfo of context.shared) {
      if (!sharedInfo[1].generate) continue
      const basename = `__federation_shared_${removeNonRegLetter(
        sharedInfo[0],
        NAME_CHAR_REG
      )}.js`
      sharedInfo[1].emitFile = this.emitFile({
        type: 'chunk',
        id: sharedInfo[1].id ?? sharedInfo[1].packagePath,
        fileName: `${context.assetsDir ? context.assetsDir + '/' : ''}${
          sharedInfo[1].root ? sharedInfo[1].root[0] + '/' : ''
        }${basename}`,
        preserveSignature: 'allow-extension',
        name: sharedInfo[0]
      })
    }
  }
}
