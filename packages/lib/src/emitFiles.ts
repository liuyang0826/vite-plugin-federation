import type { PluginContext } from 'rollup'
import type { Context } from 'types'
import dtsBuilder from './dtsBuilder'
import { extname } from 'node:path'

export default function emitFiles(this: PluginContext, context: Context) {
  if (context.expose.length) {
    this.emitFile({
      fileName: `${context.assetsDir ? context.assetsDir + '/' : ''}${
        context.filename
      }`,
      type: 'chunk',
      id: '__federation_remote',
      preserveSignature: 'strict'
    })
  }
  if (context.shared.length) {
    this.emitFile({
      type: 'chunk',
      id: '__federation_shared',
      name: 'federation-shared'
    })
  }
}

export async function emitDtsJSON(this: PluginContext, context: Context) {
  const source = await dtsBuilder(context)
  if (source.length) {
    this.emitFile({
      type: 'asset',
      source: JSON.stringify(source),
      fileName: `${
        context.assetsDir ? context.assetsDir + '/' : ''
      }${context.filename.replace(extname(context.filename), '.d.json')}`
    })
  }
}
