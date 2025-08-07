import traverse from '@babel/traverse'
import type { ParseResult } from '@babel/parser'
import type { File } from '@babel/types'
import { parse } from '@babel/parser'
import type { Context } from 'types'
import MagicString from 'magic-string'
import { str } from './utils'
import type { TransformPluginContext } from 'rollup'

export default function transform(
  this: TransformPluginContext,
  context: Context,
  code: string,
  id: string
) {
  let ast: ParseResult<File> | null = null
  try {
    ast = parse(code, { sourceType: 'module' })
  } catch {
    /* noop */
  }
  if (!ast) return

  const magicString = new MagicString(code)
  const hasStaticImported = new Map<string, string>()
  const sourceLocalNamesMap: Record<
    string,
    { localName: string; isDefault: boolean }[]
  > = {}
  let hasGetRemote = false
  let hasImportRef = false
  let hasImportShared = false
  let programPath

  traverse.default(ast, {
    enter: ({ node }: any) => {
      if (
        node.type !== 'ImportDeclaration' &&
        node.type !== 'ExportNamedDeclaration'
      ) {
        return
      }

      const moduleId = node.source?.value
      if (!moduleId) return

      const remoteIndex = context.remoteRegExps.findIndex((r) =>
        r.test(moduleId)
      )
      if (remoteIndex !== -1) {
        const remote = context.remote[remoteIndex]
        const afterImportName = `__federation_module_${moduleId.replace(
          /[@/\\.-]/g,
          ''
        )}`
        const modName = `.${moduleId.slice(remote[0].length)}`
        switch (node.type) {
          case 'ImportDeclaration': {
            if (!hasStaticImported.has(moduleId)) {
              hasStaticImported.set(moduleId, afterImportName)
              magicString.overwrite(
                node.start,
                node.end,
                `const ${afterImportName} = await __federation_method_getRemote(${str(
                  remote[0]
                )} , ${str(modName)});`
              )
              hasGetRemote = true
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
                  magicString.prepend(
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
                `const ${afterImportName} = await __federation_method_getRemote(${str(
                  remote[0]
                )}, ${str(modName)});`
              )
              hasGetRemote = true
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
              `\nexport {${exportContent.slice(0, exportContent.length - 1)}}; `
            )
            break
          }
        }
      }

      const shared = context.shared.find(
        (sharedInfo) => sharedInfo[0] === moduleId
      )

      if (shared) {
        const afterImportName = `__federation_module_${moduleId.replace(
          /[@/\\.-]/g,
          ''
        )}`
        switch (node.type) {
          case 'ImportDeclaration': {
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
                  magicString.prepend(
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
              const line = `const ${afterImportName} = await __federation_method_importShared(${str(
                moduleId
              )});\n`
              magicString.prepend(line)
              hasImportShared = true
            }
            magicString.overwrite(node.start, node.end, '')
            break
          }
          case 'ExportNamedDeclaration': {
            if (!hasStaticImported.has(moduleId)) {
              hasStaticImported.set(moduleId, afterImportName)
              const line = `const ${afterImportName} = await __federation_method_importShared(${str(
                moduleId
              )});\n`
              magicString.prepend(line)
              hasImportShared = true
            }
            magicString.overwrite(node.start, node.end, '')
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
              `\nexport {${exportContent.slice(0, exportContent.length - 1)}}; `
            )
            break
          }
        }
      }
    },
    Import({ container }) {
      const moduleId = container.arguments[0].value
      if (!moduleId) return

      const remoteIndex = context.remoteRegExps.findIndex((r) =>
        r.test(moduleId)
      )
      if (remoteIndex !== -1) {
        const remote = context.remote[remoteIndex]
        const modName = `.${moduleId.slice(remote[0].length)}`
        magicString.overwrite(
          container.start,
          container.end,
          `__federation_method_getRemote(${str(remote[0])} , ${str(modName)})`
        )
        hasGetRemote = true
      }

      const shared = context.shared.find(
        (sharedInfo) => sharedInfo[0] === moduleId
      )

      if (shared) {
        magicString.overwrite(
          container.start,
          container.end,
          `__federation_method_importShared(${str(moduleId)})`
        )
        hasImportShared = true
      }
    },
    ReturnStatement({ node }) {
      if (
        id === '\0vite/preload-helper' &&
        node.argument &&
        node.argument.type === 'BinaryExpression' &&
        node.argument.left.value[0] === '/'
      ) {
        magicString.prepend(
          'const __federation_origin = new URL(import.meta.url).origin;\n'
        )
        magicString.appendLeft(
          node.argument.left.start,
          '__federation_origin + '
        )
      }
    },
    Program(path) {
      programPath = path
    }
  })

  const sources = Object.keys(sourceLocalNamesMap)
  sources.forEach((source) => {
    sourceLocalNamesMap[source].forEach(({ localName, isDefault }) => {
      programPath.scope.bindings[localName].referencePaths.forEach(
        (referencePath) => {
          const node = referencePath.node
          const container = referencePath.container
          if (
            container.type === 'ObjectProperty' &&
            container.key.name === container.value.name &&
            container.key.start === container.value.start &&
            container.key.end === container.value.end
          ) {
            if (isDefault) {
              magicString.appendRight(container.key.end, `: ${source}`)
            } else {
              magicString.appendRight(
                container.key.end,
                `: __federation_method_importRef(${source}, __federation_var_${node.name})`
              )
              hasImportRef = true
            }
          } else if (container.type === 'ExportSpecifier') {
            if (isDefault) {
              if (
                container.local.name === container.exported.name &&
                container.local.start === container.exported.start &&
                container.local.end === container.exported.end
              ) {
                magicString.overwrite(
                  node.start,
                  node.end,
                  `${source} as ${node.name}`
                )
              } else {
                magicString.overwrite(node.start, node.end, source)
              }
            } else {
              magicString.appendLeft(
                container.start,
                `const __federation_export_${node.name} = (__federation_method_importRef(${source}, __federation_var_${node.name}));\n`
              )
              if (
                container.local.name === container.exported.name &&
                container.local.start === container.exported.start &&
                container.local.end === container.exported.end
              ) {
                magicString.overwrite(
                  node.start,
                  node.end,
                  `__federation_export_${node.name} as ${node.name}`
                )
              } else {
                magicString.overwrite(
                  node.start,
                  node.end,
                  `__federation_export_${node.name}`
                )
              }

              hasImportRef = true
            }
          } else if (container.type === 'NewExpression') {
            if (isDefault) {
              magicString.overwrite(node.start, node.end, source)
            } else {
              magicString.overwrite(
                node.start,
                node.end,
                `(__federation_method_importRef(${source}, __federation_var_${node.name}))`
              )
              hasImportRef = true
            }
          } else {
            if (isDefault) {
              magicString.overwrite(node.start, node.end, source)
            } else {
              magicString.overwrite(
                node.start,
                node.end,
                `__federation_method_importRef(${source}, __federation_var_${node.name})`
              )
              hasImportRef = true
            }
          }
        }
      )
    })
  })

  if (hasGetRemote) {
    magicString.prepend(
      `import { getRemote as __federation_method_getRemote } from '__federation_host';\n`
    )
  }

  if (hasImportRef) {
    magicString.prepend(
      `import { importRef as __federation_method_importRef } from '__federation_shared';\n`
    )
  }

  if (hasImportShared) {
    magicString.prepend(
      `import { importShared as __federation_method_importShared } from '__federation_shared';\n`
    )
  }

  if (magicString.hasChanged()) {
    return {
      code: magicString.toString(),
      map: magicString.generateMap({ hires: true })
    }
  }
}
