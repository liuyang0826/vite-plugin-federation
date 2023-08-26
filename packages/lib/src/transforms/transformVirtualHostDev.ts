import { normalizePath } from '@rollup/pluginutils'
import type { TransformPluginContext } from 'rollup'
import { getModuleMarker } from '../utils'
import type { Context } from 'types'
import { REMOTE_FROM_PARAMETER } from '../constants'
import { join } from 'node:path'

export default async function transformVirtualHostDev(
  this: TransformPluginContext,
  context: Context,
  code: string
) {
  if (!context.shared.length) return
  const scopeCode: string[] = []
  const { base, server: serverConfiguration } = context.viteDevServer.config
  const cwdPath = normalizePath(process.cwd())

  for (const item of context.shared) {
    const moduleInfo = await this.resolve(item[1].packagePath, undefined, {
      skipSelf: true
    })

    if (!moduleInfo) continue

    const moduleFilePath = normalizePath(moduleInfo.id)
    const idx = moduleFilePath.indexOf(cwdPath)

    const relativePath = idx === 0 ? moduleFilePath.slice(cwdPath.length) : null

    const sharedName = item[0]
    const obj = item[1]
    let str = ''
    if (typeof obj === 'object') {
      const origin = serverConfiguration.origin
      const pathname = normalizePath(
        join(base, relativePath ?? `/@fs/${moduleInfo.id}`)
      )
      const url = origin
        ? `'${origin}${pathname}'`
        : `window.location.origin + '${pathname}'`
      str += `get: () => get(${url}, ${REMOTE_FROM_PARAMETER})`
      scopeCode.push(`'${sharedName}':{ '${obj.version}': { ${str} } }`)
    }
  }
  return code.replace(getModuleMarker('shareScope'), scopeCode.join(',\n    '))
}
