import type { TransformPluginContext } from 'rollup'
import type { Context } from 'types'
import { str } from './utils'

export default function injectShared(
  this: TransformPluginContext,
  context: Context,
  code: string
) {
  const group = context.shared
    .filter((item) => item[1].import)
    .reduce((acc, item) => {
      const code = `{ name: ${str(item[0])}, factory: () => import(${str(
        item[1].packagePath
      )}).then(module => () => module)${
        item[1].version ? `, version: ${str(item[1].version)}` : ''
      } }`

      const shareScope = item[1].shareScope ?? 'default'

      if (acc[shareScope]) {
        acc[shareScope].push(code)
      } else {
        acc[shareScope] = [code]
      }
      return acc
    }, {} as Record<string, string[]>)

  const sharedProviderMapCode: string[] = Object.keys(group).map(
    (shareScope) => {
      return `${str(shareScope)}: [\n    ${group[shareScope].join(
        ',\n    '
      )}\n  ]`
    }
  )

  if (sharedProviderMapCode.length) {
    code = code.replace(
      '// sharedProviderMapCode',
      sharedProviderMapCode.join(',\n  ')
    )
  }

  const sharedConsumerMapCode = context.shared.map((item) => {
    let fn = 'load'
    const args = [str(item[1].shareScope ?? 'default'), str(item[1].shareKey)]
    if (item[1].requiredVersion) {
      if (item[1].strictVersion) {
        fn += 'Strict'
      }
      if (item[1].singleton) {
        fn += 'Singleton'
      }
      args.push(`parseRange(${str(item[1].requiredVersion)})`)
      fn += 'VersionCheck'
    } else {
      if (item[1].singleton) {
        fn += 'Singleton'
      }
    }
    if (item[1].import) {
      fn += 'Fallback'
    }

    return `${str(item[0])}: () => ${fn}(${args.join(', ')}, ${
      item[1].import
        ? `() => import(${str(
            item[1].packagePath
          )}).then(module => () => module),`
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
