import type { PluginContext } from 'rollup'
import type { Context } from 'types'

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
  if (context.shared) {
    this.emitFile({
      type: 'chunk',
      id: '__federation_shared',
      name: 'federation-shared'
    })
  }
}
