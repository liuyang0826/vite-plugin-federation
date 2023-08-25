import traverse from '@babel/traverse'
import type { ParseResult } from '@babel/parser'
import type { File } from '@babel/types'
import { parse } from '@babel/parser'
import type { Context } from 'types'
import MagicString from 'magic-string'
import type { Remote } from '../utils'

export default function transfromProduction(
  context: Context,
  code: string,
  remotes: Remote[]
) {
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
  let hasImportShared = false
  const modify = false

  traverse.default(ast, {
    enter({ node, scope }: any) {
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
          context.shared.some((sharedInfo) => sharedInfo[0] === moduleId)
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
      if (context.shared.some((sharedInfo) => sharedInfo[0] === moduleId)) {
        magicString.overwrite(
          container.start,
          container.end,
          `importShared(${JSON.stringify(moduleId)})`
        )
        hasImportShared = true
      }
    }
  })

  const sources = Object.keys(sourceLocalNamesMap)
  if (sources.length) {
    traverse.default(ast, {
      Program(path) {
        sources.forEach((source) => {
          sourceLocalNamesMap[source].forEach(({ localName, isDefault }) => {
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
          })
        })
      }
    })
  }

  if (requiresRuntime) {
    magicString.prepend(
      `import { ensure as __federation_method_ensure, getRemote as __federation_method_getRemote, wrapDefault as __federation_method_wrapDefault, unwrapDefault as __federation_method_unwrapDefault, importRef as __federation_method_importRef } from '__federation__';\n`
    )
  }

  if (hasImportShared) {
    magicString.prepend(
      `import { importShared } from '__federation_fn_import';\n`
    )
  }

  if (requiresRuntime || hasImportShared || modify) {
    return {
      code: magicString.toString(),
      map: magicString.generateMap({ hires: true })
    }
  }
}
