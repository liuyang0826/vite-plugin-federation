import type { PluginContext } from 'rollup'
import type { Context, VitePluginFederationOptions } from 'types'
import { removeNonRegLetter } from '.'
import { NAME_CHAR_REG } from '../constants'

export default function emitFiles(
  this: PluginContext,
  context: Context,
  options: VitePluginFederationOptions
) {
  // if (context.shared.length && context.isRemote) {
  //   this.emitFile({
  //     fileName: `${
  //       context.assetsDir ? context.assetsDir + '/' : ''
  //     }__federation_fn_import.js`,
  //     type: 'chunk',
  //     id: '__federation_fn_import',
  //     preserveSignature: 'strict'
  //   })
  // }

  if (context.expose.length > 0) {
    this.emitFile({
      fileName: `${context.assetsDir ? context.assetsDir + '/' : ''}${
        options.filename
      }`,
      type: 'chunk',
      id: '__remoteEntryHelper__',
      preserveSignature: 'strict'
    })
  }

  if (context.isShared) {
    for (const sharedInfo of context.shared) {
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

  if (context.isRemote) {
    for (const expose of context.expose) {
      this.emitFile({
        type: 'chunk',
        id: expose[1].id ?? expose[1].import,
        name: context.exposesKeyMap.get(expose[0]),
        preserveSignature: 'allow-extension'
      })
    }
  }
}
