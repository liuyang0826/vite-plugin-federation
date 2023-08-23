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

import type { ConfigTypeSet, VitePluginFederationOptions } from 'types'
import traverse from '@babel/traverse'
import { parse } from '@babel/parser'
import MagicString from 'magic-string'
import type { AcornNode, TransformPluginContext } from 'rollup'
import {
  createRemotesMap,
  getModuleMarker,
  parseRemoteOptions,
  Remote,
  removeNonRegLetter,
  REMOTE_FROM_PARAMETER,
  NAME_CHAR_REG
} from '../utils'
import { builderInfo, EXPOSES_KEY_MAP, parsedOptions } from '../public'
import { basename } from 'path'
import type { PluginHooks } from '../../types/pluginHooks'

const sharedFileName2Prop: Map<string, ConfigTypeSet> = new Map<
  string,
  ConfigTypeSet
>()

export function prodRemotePlugin(
  options: VitePluginFederationOptions
): PluginHooks {
  parsedOptions.prodRemote = parseRemoteOptions(options)
  const remotes: Remote[] = []
  for (const item of parsedOptions.prodRemote) {
    remotes.push({
      id: item[0],
      regexp: new RegExp(`^${item[0]}/.+?`),
      config: item[1]
    })
  }

  return {
    name: 'originjs:remote-production',
    virtualFile: {
      // language=JS
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

                function get(name, ${REMOTE_FROM_PARAMETER}) {
                    return __federation_import(name).then(module => () => {
                        if (${REMOTE_FROM_PARAMETER} === 'webpack') {
                            return Object.prototype.toString.call(module).indexOf('Module') > -1 && module.default ? module.default : module
                        }
                        return module
                    })
                }

                const wrapShareModule = ${REMOTE_FROM_PARAMETER} => {
                    return {
                        ${getModuleMarker('shareScope')}
                    }
                }

                async function __federation_import(name) {
                    return import(name);
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
                                        remote.lib.init(wrapShareModule(remote.from))
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
                                            const shareScope = wrapShareModule(remote.from)
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
                    return (module?.__esModule || module?.[Symbol.toStringTag] === 'Module') ? module.default : module
                }

                function __federation_method_wrapDefault(module, need) {
                    if (!module?.default && need) {
                        let obj = Object.create(null);
                        obj.default = module;
                        obj.__esModule = true;
                        return obj;
                    }
                    return module;
                }

                function __federation_method_getRemote(remoteName, componentName) {
                    return __federation_method_ensure(remoteName).then((remote) => remote.get(componentName).then(factory => factory()));
                }

                function __federation_method_importRef(source, varName) {
                    return source[varName]
                }

                export {
                    __federation_method_ensure,
                    __federation_method_getRemote,
                    __federation_method_unwrapDefault,
                    __federation_method_wrapDefault,
                    __federation_method_importRef
                }
            `
    },

    async transform(this: TransformPluginContext, code: string, id: string) {
      if (builderInfo.isShared) {
        for (const sharedInfo of parsedOptions.prodShared) {
          if (!sharedInfo[1].emitFile) {
            const basename = `__federation_shared_${removeNonRegLetter(
              sharedInfo[0],
              NAME_CHAR_REG
            )}.js`
            sharedInfo[1].emitFile = this.emitFile({
              type: 'chunk',
              id: sharedInfo[1].id ?? sharedInfo[1].packagePath,
              fileName: `${
                builderInfo.assetsDir ? builderInfo.assetsDir + '/' : ''
              }${
                sharedInfo[1].root ? sharedInfo[1].root[0] + '/' : ''
              }${basename}`,
              preserveSignature: 'allow-extension',
              name: sharedInfo[0]
            })
            sharedFileName2Prop.set(basename, sharedInfo as ConfigTypeSet)
          }
        }

        if (id === '\0virtual:__federation_fn_import') {
          const moduleMapCode = parsedOptions.prodShared
            .filter((shareInfo) => shareInfo[1].generate)
            .map(
              (sharedInfo) =>
                `'${sharedInfo[0]}':{get:()=>()=>__federation_import('./${
                  sharedInfo[1].root ? `${sharedInfo[1].root[0]}/` : ''
                }${basename(
                  this.getFileName(sharedInfo[1].emitFile)
                )}'),import:${sharedInfo[1].import}${
                  sharedInfo[1].requiredVersion
                    ? `,requiredVersion:'${sharedInfo[1].requiredVersion}'`
                    : ''
                }}`
            )
            .join(',')
          return code.replace(
            getModuleMarker('moduleMap', 'var'),
            `{${moduleMapCode}}`
          )
        }
      }

      if (builderInfo.isRemote) {
        for (const expose of parsedOptions.prodExpose) {
          if (!expose[1].emitFile) {
            expose[1].emitFile = this.emitFile({
              type: 'chunk',
              id: expose[1].id ?? expose[1].import,
              name: EXPOSES_KEY_MAP.get(expose[0]),
              preserveSignature: 'allow-extension'
            })
          }
        }
      }

      if (builderInfo.isHost) {
        if (id === '\0virtual:__federation__') {
          const res: string[] = []
          parsedOptions.prodShared.forEach((arr) => {
            const obj = arr[1]
            let str = ''
            if (typeof obj === 'object') {
              const fileName = `./${basename(this.getFileName(obj.emitFile))}`
              str += `get:()=>get('${fileName}', ${REMOTE_FROM_PARAMETER}), loaded:1`
              res.push(`'${arr[0]}':{'${obj.version}':{${str}}}`)
            }
          })
          return code.replace(getModuleMarker('shareScope'), res.join(','))
        }
      }

      if (builderInfo.isHost || builderInfo.isShared) {
        let ast: AcornNode | null = null
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
        let hasImportShared = false
        const modify = false

        traverse.default(ast, {
          enter({ node }: any) {
            if (
              node.type === 'ImportDeclaration' ||
              node.type === 'ExportNamedDeclaration'
            ) {
              const moduleId = node.source?.value
              if (node.source?.value?.indexOf('/') > -1) {
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
                      if (node.specifiers.length) {
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
                      }

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
              if (
                moduleId &&
                parsedOptions.prodShared.some(
                  (sharedInfo) => sharedInfo[0] === moduleId
                )
              ) {
                const afterImportName = `__federation_var_${moduleId.replace(
                  /[@/\\.-]/g,
                  ''
                )}`
                switch (node.type) {
                  case 'ImportDeclaration': {
                    const afterImportName = `__federation_var_${moduleId.replace(
                      /[@/\\.-]/g,
                      ''
                    )}`
                    if (node.specifiers.length) {
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
                    }
                    if (!hasStaticImported.has(moduleId)) {
                      hasStaticImported.set(moduleId, afterImportName)
                      const line = `const ${afterImportName} = await importShared(${JSON.stringify(
                        moduleId
                      )});\n`
                      magicString.overwrite(node.start, node.end, line)
                      hasImportShared = true
                    } else {
                      magicString.overwrite(node.start, node.end, '')
                    }
                    break
                  }
                  case 'ExportNamedDeclaration': {
                    if (!hasStaticImported.has(moduleId)) {
                      hasStaticImported.set(moduleId, afterImportName)
                      magicString.overwrite(
                        node.start,
                        node.end,
                        `const ${afterImportName} = importShared(${JSON.stringify(
                          moduleId
                        )})`
                      )
                      hasImportShared = true
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
            if (
              parsedOptions.prodShared.some(
                (sharedInfo) => sharedInfo[0] === moduleId
              )
            ) {
              magicString.overwrite(
                container.start,
                container.end,
                `importShared('${JSON.stringify(moduleId)}')`
              )
              hasImportShared = true
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
            `import {__federation_method_ensure, __federation_method_getRemote , __federation_method_wrapDefault , __federation_method_unwrapDefault, __federation_method_importRef} from '__federation__';\n\n`
          )
        }

        if (hasImportShared) {
          magicString.prepend(
            `import {importShared} from '\0virtual:__federation_fn_import';\n`
          )
        }

        if (requiresRuntime || hasImportShared || modify) {
          return {
            code: magicString.toString(),
            map: magicString.generateMap({ hires: true })
          }
        }
      }
    }
  }
}

export { sharedFileName2Prop }
