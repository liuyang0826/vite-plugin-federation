import virtual from '@rollup/plugin-virtual'
import federation from './federation.js?raw'
import federation_fn_import from './federationFnImport.js?raw'
import remoteEntryHelper from './remoteEntryHelper.js?raw'
import {
  Remote,
  createRemotesMap,
  getModuleMarker,
  removeNonRegLetter
} from '../utils'
import type { Context, VitePluginFederationOptions } from 'types'
import { resolve } from 'node:path'
import {
  DYNAMIC_LOADING_CSS,
  DYNAMIC_LOADING_CSS_PREFIX,
  NAME_CHAR_REG,
  REMOTE_FROM_PARAMETER
} from '../constants'
import { normalizePath } from '@rollup/pluginutils'

export default function createVirtual(
  context: Context,
  options: VitePluginFederationOptions,
  remotes: Remote[]
) {
  let __federation__ = `${createRemotesMap(remotes)}\n${federation.replace(
    /REMOTE_FROM_PARAMETER/g,
    REMOTE_FROM_PARAMETER
  )}`
  if (context.isHost) {
    __federation__ = __federation__.replace(
      "// getModuleMarker('shareScope')",
      getModuleMarker('shareScope')
    )
  }

  let __remoteEntryHelper__ = remoteEntryHelper
  let moduleMap = ''
  // exposes module
  const exposesKeyMap = (context.exposesKeyMap = new Map())
  for (const item of context.expose) {
    const exposeFilepath = normalizePath(resolve(item[1].import))
    exposesKeyMap.set(
      item[0],
      `__federation_expose_${removeNonRegLetter(item[0], NAME_CHAR_REG)}`
    )
    moduleMap += `\n"${item[0]}":()=>{
        ${DYNAMIC_LOADING_CSS}('${DYNAMIC_LOADING_CSS_PREFIX}${exposeFilepath}')
        return __federation_import('\${__federation_expose_${item[0]}}').then(module => () => module)},`
  }

  __remoteEntryHelper__ = __remoteEntryHelper__
    .replace('// moduleMap', moduleMap)
    .replace('DYNAMIC_LOADING_CSS', DYNAMIC_LOADING_CSS)
    .replace('options.filename', options.filename as string)
    .replace('options.promiseExportName', options.promiseExportName as string)

  return virtual({
    __federation__: __federation__,
    __federation_fn_import: federation_fn_import,
    __remoteEntryHelper__: __remoteEntryHelper__
  })
}
