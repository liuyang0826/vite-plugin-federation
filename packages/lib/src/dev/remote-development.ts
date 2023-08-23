// *****************************************************************************
// Copyright (C) 2022 Origin.js and others.
//
// This program and the accompanying materials are licensed under Mulan PSL v2.
// You can use this software according to the terms and conditions of the Mulan PSL v2.
// You may obtain a copy of Mulan PSL v2 at:
//          http://license.coscl.org.cn/MulanPSL2
// THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
// EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
// MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
// See the Mulan PSL v2 for more details.
//
// SPDX-License-Identifier: MulanPSL-2.0
// *****************************************************************************

import type { UserConfig } from 'vite'
import type {
  ConfigTypeSet,
  RemotesConfig,
  VitePluginFederationOptions
} from 'types'
import traverse from '@babel/traverse'
import type { ParseResult } from '@babel/parser'
import type { File } from '@babel/types'
import { parse } from '@babel/parser'
import MagicString from 'magic-string'
import type { TransformPluginContext } from 'rollup'
import type { ViteDevServer } from '../../types/viteDevServer'
import {
  createRemotesMap,
  getFileExtname,
  getModuleMarker,
  normalizePath,
  parseRemoteOptions,
  REMOTE_FROM_PARAMETER
} from '../utils'
import { builderInfo, parsedOptions } from '../public'
import type { PluginHooks } from '../../types/pluginHooks'
import { getPackageInfo } from 'local-pkg'

export function devRemotePlugin(
  options: VitePluginFederationOptions
): PluginHooks {
  parsedOptions.devRemote = parseRemoteOptions(options)
  const remotes: { id: string; regexp: RegExp; config: RemotesConfig }[] = []
  for (const item of parsedOptions.devRemote) {
    remotes.push({
      id: item[0],
      regexp: new RegExp(`^${item[0]}/.+?`),
      config: item[1]
    })
  }

  const needHandleFileType = [
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.mjs',
    '.cjs',
    '.vue',
    '.svelte'
  ]
  options.transformFileTypes = (options.transformFileTypes ?? [])
    .concat(needHandleFileType)
    .map((item) => item.toLowerCase())
  const transformFileTypeSet = new Set(options.transformFileTypes)
  let viteDevServer: ViteDevServer
  return {
    name: 'originjs:remote-development',
    virtualFile: {
      __federation__: `
${createRemotesMap(remotes)}
const loadJS = async (url, fn) => {
  const resolvedUrl = typeof url === 'function' ? await url() : url;
  const script = document.createElement('script')
  script.type = 'text/javascript';
  script.onload = fn;
  script.src = resolvedUrl;
  document.getElementsByTagName('head')[0].appendChild(script);
}
function get(name, ${REMOTE_FROM_PARAMETER}){
  return import(/* @vite-ignore */ name).then(module => ()=> {
    if (${REMOTE_FROM_PARAMETER} === 'webpack') {
      return Object.prototype.toString.call(module).indexOf('Module') > -1 && module.default ? module.default : module
    }
    return module
  })
}
const wrapShareScope = ${REMOTE_FROM_PARAMETER} => {
  return {
    ${getModuleMarker('shareScope')}
  }
}
const initMap = Object.create(null);
async function __federation_method_ensure(remoteId) {
  const remote = remotesMap[remoteId];
  if (!remote.inited) {
    if ('var' === remote.format) {
      // loading js with script tag
      return new Promise(resolve => {
        const callback = () => {
          if (!remote.inited) {
            remote.lib = window[remoteId];
            remote.lib.init(wrapShareScope(remote.from))
            remote.inited = true;
          }
          resolve(remote.lib);
        }
        return loadJS(remote.url, callback);
      });
    } else if (['esm', 'systemjs'].includes(remote.format)) {
      // loading js with import(...)
      return new Promise((resolve, reject) => {
        const getUrl = typeof remote.url === 'function' ? remote.url : () => Promise.resolve(remote.url);
        getUrl().then(url => {
          import(/* @vite-ignore */ url).then(lib => {
            if (!remote.inited) {
              const shareScope = wrapShareScope(remote.from)
              lib.init(shareScope);
              remote.lib = lib;
              remote.lib.init(shareScope);
              remote.inited = true;
            }
            resolve(remote.lib);
          }).catch(reject)
        })
      })
    }
  } else {
    return remote.lib;
  }
}

function __federation_method_unwrapDefault(module) {
  return (module?.__esModule || module?.[Symbol.toStringTag] === 'Module')?module.default:module
}

function __federation_method_wrapDefault(module ,need){
  if (!module?.default && need) {
    let obj = Object.create(null);
    obj.default = module;
    obj.__esModule = true;
    return obj;
  }
  return module; 
}

function __federation_method_getRemote(remoteName,  componentName){
  return __federation_method_ensure(remoteName).then((remote) => remote.get(componentName).then(factory => factory()));
}

function __federation_method_importRef(source, varName) {
  return source[varName]
}
export {__federation_method_ensure, __federation_method_getRemote , __federation_method_unwrapDefault , __federation_method_wrapDefault, __federation_method_importRef}
;`
    },
    config(config: UserConfig) {
      // need to include remotes in the optimizeDeps.exclude
      if (parsedOptions.devRemote.length) {
        const excludeRemotes: string[] = []
        parsedOptions.devRemote.forEach((item) => excludeRemotes.push(item[0]))
        let optimizeDeps = config.optimizeDeps
        if (!optimizeDeps) {
          optimizeDeps = config.optimizeDeps = {}
        }
        if (!optimizeDeps.exclude) {
          optimizeDeps.exclude = []
        }
        optimizeDeps.exclude = optimizeDeps.exclude.concat(excludeRemotes)
      }
    },

    configureServer(server: ViteDevServer) {
      // get moduleGraph for dev mode dynamic reference
      viteDevServer = server
    },
    async transform(this: TransformPluginContext, code: string, id: string) {
      if (builderInfo.isHost && !builderInfo.isRemote) {
        for (const arr of parsedOptions.devShared) {
          if (!arr[1].version && !arr[1].manuallyPackagePathSetting) {
            let packageJson
            try {
              packageJson = (await getPackageInfo(arr[0]))?.packageJson
            } catch {
              /* noop */
            }
            if (!packageJson) {
              this.error(
                `No description file or no version in description file (usually package.json) of ${arr[0]}. Add version to description file, or manually specify version in shared config.`
              )
            } else {
              arr[1].version = packageJson.version
            }
          }
        }
      }

      if (id === '\0virtual:__federation__') {
        const scopeCode = await devSharedScopeCode.call(
          this,
          parsedOptions.devShared
        )
        return code.replace(getModuleMarker('shareScope'), scopeCode.join(','))
      }

      // ignore some not need to handle file types
      const fileExtname = getFileExtname(id)
      if (!transformFileTypeSet.has((fileExtname ?? '').toLowerCase())) {
        return
      }

      let ast: ParseResult<File> | null = null
      try {
        ast = parse(code, { sourceType: 'module' })
      } catch (err) {
        console.error(err)
      }
      if (!ast) {
        return null
      }

      const magicString = new MagicString(code)
      const hasStaticImported = new Map<string, string>()
      const sourceLocalNamesMap: Record<
        string,
        { localName: string; isDefault: boolean }[]
      > = {}

      let requiresRuntime = false
      traverse.default(ast, {
        enter({ node }: any) {
          if (
            (node.type === 'ImportDeclaration' ||
              node.type === 'ExportNamedDeclaration') &&
            node.source?.value?.indexOf('/') > -1
          ) {
            const moduleId = node.source.value
            const remote = remotes.find((r) => r.regexp.test(moduleId))
            if (remote) {
              const afterImportName = `__federation_var_${moduleId.replace(
                /[@/\\.-]/g,
                ''
              )}`
              requiresRuntime = true
              const modName = `.${moduleId.slice(remote.id.length)}`
              switch (node.type) {
                case 'ImportDeclaration': {
                  if (!hasStaticImported.has(moduleId)) {
                    hasStaticImported.set(moduleId, afterImportName)
                    magicString.overwrite(
                      node.start,
                      node.end,
                      `const ${afterImportName} = await __federation_method_getRemote(${JSON.stringify(
                        remote.id
                      )} , ${JSON.stringify(modName)});`
                    )
                  } else {
                    magicString.overwrite(node.start, node.end, '')
                  }
                  if (!sourceLocalNamesMap[afterImportName]) {
                    sourceLocalNamesMap[afterImportName] = []
                  }
                  node.specifiers.forEach((spec) => {
                    // default import , like import a from 'lib'
                    if (spec.type === 'ImportDefaultSpecifier') {
                      sourceLocalNamesMap[afterImportName].push({
                        localName: spec.local.name,
                        isDefault: true
                      })
                    } else if (spec.type === 'ImportSpecifier') {
                      //  like import {a as b} from 'lib'
                      const localName = spec.local.name
                      sourceLocalNamesMap[afterImportName].push({
                        localName: localName,
                        isDefault: false
                      })
                      magicString.appendRight(
                        node.end,
                        `\nconst __federation_var_${localName} = '${spec.imported.name}';`
                      )
                    } else if (spec.type === 'ImportNamespaceSpecifier') {
                      //  like import * as a from 'lib'
                      sourceLocalNamesMap[afterImportName].push({
                        localName: spec.local.name,
                        isDefault: true
                      })
                    }
                  })
                  break
                }
                case 'ExportNamedDeclaration': {
                  if (!hasStaticImported.has(moduleId)) {
                    hasStaticImported.set(moduleId, afterImportName)
                    magicString.overwrite(
                      node.start,
                      node.end,
                      `const ${afterImportName} = await __federation_method_getRemote(${JSON.stringify(
                        remote.id
                      )} , ${JSON.stringify(modName)});`
                    )
                  } else {
                    magicString.overwrite(node.start, node.end, '')
                  }
                  const specifiers = node.specifiers
                  let exportContent = ''
                  let deconstructContent = ''
                  specifiers.forEach((spec) => {
                    const localName = spec.local.name
                    const exportName = spec.exported.name
                    const variableName = `${afterImportName}_${localName}`
                    deconstructContent = deconstructContent.concat(
                      `${localName}: ${variableName},`
                    )
                    exportContent = exportContent.concat(
                      `${variableName} as ${exportName},`
                    )
                  })
                  magicString.append(
                    `\nconst { ${deconstructContent.slice(
                      0,
                      deconstructContent.length - 1
                    )} } = ${afterImportName}; \n`
                  )
                  magicString.append(
                    `\nexport {${exportContent.slice(
                      0,
                      exportContent.length - 1
                    )}}; `
                  )
                  break
                }
              }
            }
          }
        },
        Import({ container }) {
          const moduleId = container.arguments[0].value
          if (!moduleId) return
          if (moduleId.indexOf('/') > -1) {
            const remote = remotes.find((r) => r.regexp.test(moduleId))
            if (remote) {
              requiresRuntime = true
              const needWrap = remote.config.from === 'vite'
              const modName = `.${moduleId.slice(remote.id.length)}`
              magicString.overwrite(
                container.start,
                container.end,
                `__federation_method_getRemote(${JSON.stringify(
                  remote.id
                )} , ${JSON.stringify(
                  modName
                )}).then(module=>__federation_method_wrapDefault(module, ${needWrap}))`
              )
            }
          }
        }
      })

      const sources = Object.keys(sourceLocalNamesMap)
      if (sources.length) {
        traverse.default(ast, {
          Program(path: any) {
            sources.forEach((source) => {
              sourceLocalNamesMap[source].forEach(
                ({ localName, isDefault }) => {
                  path.scope.bindings[localName].referencePaths.forEach(
                    (referencePath) => {
                      const node = referencePath.node
                      const container = referencePath.container
                      if (
                        container.type === 'ObjectProperty' &&
                        container.key.name === container.value.name &&
                        container.key.start === container.value.start &&
                        container.key.end === container.value.end
                      ) {
                        magicString.appendRight(
                          container.key.end,
                          `: ${
                            isDefault
                              ? `__federation_method_unwrapDefault(${source})`
                              : `__federation_method_importRef(${source}, __federation_var_${node.name})`
                          }`
                        )
                      } else if (container.type === 'NewExpression') {
                        magicString.overwrite(
                          node.start,
                          node.end,
                          isDefault
                            ? `(__federation_method_unwrapDefault(${source}))`
                            : `(__federation_method_importRef(${source}, __federation_var_${node.name}))`
                        )
                      } else {
                        magicString.overwrite(
                          node.start,
                          node.end,
                          isDefault
                            ? container.type === 'ExportSpecifier'
                              ? source
                              : `__federation_method_unwrapDefault(${source})`
                            : `__federation_method_importRef(${source}, __federation_var_${node.name})`
                        )
                      }
                      requiresRuntime = true
                    }
                  )
                }
              )
            })
          }
        })
      }

      if (requiresRuntime) {
        magicString.prepend(
          `import {__federation_method_ensure, __federation_method_getRemote , __federation_method_wrapDefault , __federation_method_unwrapDefault,__federation_method_importRef} from '__federation__';\n\n`
        )
      }
      return magicString.toString()
    }
  }

  async function devSharedScopeCode(
    this: TransformPluginContext,
    shared: (string | ConfigTypeSet)[]
  ): Promise<string[]> {
    const res: string[] = []
    if (shared.length) {
      const serverConfiguration = viteDevServer.config.server
      const cwdPath = normalizePath(process.cwd())

      for (const item of shared) {
        const moduleInfo = await this.resolve(item[1].packagePath, undefined, {
          skipSelf: true
        })

        if (!moduleInfo) continue

        const moduleFilePath = normalizePath(moduleInfo.id)
        const idx = moduleFilePath.indexOf(cwdPath)

        const relativePath =
          idx === 0 ? moduleFilePath.slice(cwdPath.length) : null

        const sharedName = item[0]
        const obj = item[1]
        let str = ''
        if (typeof obj === 'object') {
          const origin = serverConfiguration.origin
          const pathname = relativePath ?? `/@fs/${moduleInfo.id}`
          const url = origin
            ? `'${origin}${pathname}'`
            : `window.location.origin+'${pathname}'`
          str += `get:()=> get(${url}, ${REMOTE_FROM_PARAMETER})`
          res.push(`'${sharedName}':{'${obj.version}':{${str}}}`)
        }
      }
    }
    return res
  }
}
