import type { TransformPluginContext } from 'rollup'
import { getModuleMarker, normalizePath } from '../utils'
import type { Context } from 'types'
import { basename, join } from 'node:path'

export default async function transformVirtualHost(
  this: TransformPluginContext,
  context: Context,
  code: string
) {
  if (!context.shared.length) return
  const scopeCode: string[] = []
  if (context.viteDevServer) {
    const { base, server: serverConfiguration } = context.viteDevServer.config
    const cwdPath = normalizePath(process.cwd())

    for (const item of context.shared) {
      const moduleInfo = await this.resolve(item[1].packagePath, undefined, {
        skipSelf: true
      })

      if (!moduleInfo) continue

      const moduleFilePath = normalizePath(moduleInfo.id)
      const idx = moduleFilePath.indexOf(cwdPath)

      const relativePath =
        idx === 0 ? moduleFilePath.slice(cwdPath.length) : null

      const origin = serverConfiguration.origin
      const pathname = normalizePath(
        join(base, relativePath ?? `/@fs/${moduleInfo.id}`)
      )
      const url = origin
        ? `'${origin}${pathname}'`
        : `window.location.origin + '${pathname}'`
      scopeCode.push(
        `'${item[0]}':{ '${item[1].version}': { get: () => get(${url}) } }`
      )
    }
  } else {
    context.shared.forEach((arr) => {
      const obj = arr[1]
      let str = ''
      if (typeof obj === 'object') {
        const fileName = `./${basename(this.getFileName(obj.emitFile))}`
        str += `get: () => get('${fileName}'), loaded: 1`
        scopeCode.push(`'${arr[0]}':{ '${obj.version}':{ ${str} } }`)
      }
    })
  }

  return code.replace(getModuleMarker('shareScope'), scopeCode.join(',\n    '))
}
