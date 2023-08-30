import virtual from '@rollup/plugin-virtual'
import host from './host.js?raw'
import shared from './shared.js?raw'
import remote from './remote.js?raw'
import utils from './utils.js?raw'
import { Remote, createRemotesMap, str } from '../utils'
import type { Context } from 'types'

export default function createVirtual(context: Context, remotes: Remote[]) {
  const __federation_host = host.replace(
    '// remotesMap',
    createRemotesMap(remotes)
  )

  let __federation_remote = remote
  const moduleMapCode = context.expose.map((item) => {
    return `${str(item[0])}: () => import(${str(
      item[1].import
    )}).then(module => () => module)`
  })

  __federation_remote = __federation_remote.replace(
    '// moduleMapCode',
    moduleMapCode.join(',\n  ')
  )

  return virtual({
    __federation_host: __federation_host,
    __federation_shared: shared,
    __federation_remote: __federation_remote,
    __federation_utils: utils
  })
}
