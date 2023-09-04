import type { TransformPluginContext } from 'rollup'
import type { Context } from 'types'
import { str } from './utils'

export default function injectShared(
  this: TransformPluginContext,
  context: Context,
  code: string
) {
  const sharedProvidersCode: string[] = context.shared
    .filter((item) => context.isHost || item[1].import)
    .map((item) => {
      return `{ name: ${str(item[0])}, factory: () => import(${str(
        item[1].packagePath
      )}), version: ${str(item[1].version)} }`
    })

  if (sharedProvidersCode.length) {
    code = code.replace(
      '// sharedProvidersCode',
      sharedProvidersCode.join(',\n  ')
    )
  }

  const sharedConsumerMapCode = context.shared.map((item) => {
    let fn = 'load'
    const args = [str(item[1].shareScope ?? 'default'), str(item[0])]
    if (item[1].requiredVersion) {
      if (item[1].strictVersion) {
        fn += 'Strict'
      }
      if (item[1].singleton) {
        fn += 'Singleton'
      }
      args.push(`parseVersion(${str(item[1].requiredVersion)})`)
      fn += 'VersionCheck'
    } else {
      if (item[1].singleton) {
        fn += 'Singleton'
      }
    }
    if (item[1].import) {
      fn += 'Fallback'
    }

    return `${str(item[0])}: (${
      context.viteDevServer ? 'fallback' : ''
    }) => ${fn}(${args.join(', ')}, ${
      context.viteDevServer ? 'fallback ? fallback : ' : ''
    }${
      context.isHost || item[1].import
        ? `() => import(${str(item[1].packagePath)}),`
        : context.viteDevServer
        ? 'undefined'
        : ''
    })`
  })

  return sharedConsumerMapCode.length
    ? code.replace(
        '// sharedConsumerMap',
        `${sharedConsumerMapCode.join(',\n  ')}`
      )
    : code
}
