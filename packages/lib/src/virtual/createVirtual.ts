import virtual from '@rollup/plugin-virtual'
import host from './host.js?raw'
import shared from './shared.js?raw'
import remote from './remote.js?raw'
import utils from './utils.js?raw'
import {
  Remote,
  createRemotesMap,
  normalizePath,
  removeNonRegLetter
} from '../utils'
import type { Context, VitePluginFederationOptions } from 'types'
import { resolve } from 'node:path'
import {
  DYNAMIC_LOADING_CSS,
  DYNAMIC_LOADING_CSS_PREFIX,
  NAME_CHAR_REG
} from '../constants'

export default function createVirtual(
  context: Context,
  options: VitePluginFederationOptions,
  remotes: Remote[]
) {
  const __federation_host = host.replace(
    '// remotesMap',
    createRemotesMap(remotes)
  )

  let __federation_remote = remote
  let moduleMap = ''
  // exposes module
  if (context.viteDevServer) {
    for (const item of context.expose) {
      moduleMap += `\n"${item[0]}": ()=> {
          return __federation_import(${JSON.stringify(
            item[1].import
          )}).then(module => () => module)},`
    }
  } else {
    const exposesKeyMap = (context.exposesKeyMap = new Map())
    for (const item of context.expose) {
      const exposeFilepath = normalizePath(resolve(item[1].import))
      exposesKeyMap.set(
        item[0],
        `__federation_expose_${removeNonRegLetter(item[0], NAME_CHAR_REG)}`
      )
      moduleMap += `\n"${item[0]}": ()=> {
          ${DYNAMIC_LOADING_CSS}('${DYNAMIC_LOADING_CSS_PREFIX}${exposeFilepath}')
          return __federation_import('\${__federation_expose_${item[0]}}').then(module => () => module)},`
    }
  }

  __federation_remote = __federation_remote
    .replace('// moduleMap', moduleMap)
    .replace('DYNAMIC_LOADING_CSS', DYNAMIC_LOADING_CSS)
    .replace('options.filename', options.filename as string)
    .replace('options.promiseExportName', options.promiseExportName as string)

  return virtual({
    __federation_host: __federation_host,
    __federation_shared: shared,
    __federation_remote: __federation_remote,
    __federation_utils: utils
  })
}
