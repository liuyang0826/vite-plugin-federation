import traverse from '@babel/traverse'
import type { ParseResult } from '@babel/parser'
import type { File } from '@babel/types'
import { parse } from '@babel/parser'
import type { Context } from 'types'
import MagicString from 'magic-string'
import { str, type Remote } from './utils'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import {
  COMMONJS_PROXY_SUFFIX,
  OPTIMIZE_DEPS_NAMESPACE,
  OPTIMIZE_LOCAL_SUFFIX
} from './constants'
import type { TransformPluginContext } from 'rollup'

export default async function transform(
  this: TransformPluginContext,
  context: Context,
  code: string,
  remotes: Remote[],
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
  const promises: Promise<void>[] = []
  let hasGetRemote = false
  let hasImportRef = false
  let hasImportShared = false
  const optimizeNodes: any[] = []

  traverse.default(ast, {
    enter: ({ node }: any) => {
      const leadingComment = node.leadingComments?.[0].value
      if (
        leadingComment &&
        leadingComment.startsWith(` ${OPTIMIZE_DEPS_NAMESPACE}`) &&
        !leadingComment.endsWith(OPTIMIZE_LOCAL_SUFFIX)
      ) {
        optimizeNodes.push(node)
        return
      }

      if (
        node.type !== 'ImportDeclaration' &&
        node.type !== 'ExportNamedDeclaration'
      ) {
        return
      }

      let moduleId = node.source?.value
      if (!moduleId) return

      promises.push(
        Promise.resolve().then(async () => {
          if (moduleId.endsWith(COMMONJS_PROXY_SUFFIX)) {
            try {
              const path = moduleId.slice(1, -COMMONJS_PROXY_SUFFIX.length)
              const packageJsonPath = searchPackageJSON(path)
              if (packageJsonPath) {
                const pkgName = JSON.parse(
                  readFileSync(packageJsonPath, 'utf8')
                ).name
                if (
                  path ===
                  (
                    await this.resolve(pkgName, id, {
                      custom: { 'node-resolve': { isRequire: true } }
                    })
                  )?.id
                ) {
                  moduleId = pkgName
                }
              }
            } catch {
              /* noop */
            }
          }

          if (moduleId.indexOf('/') > -1) {
            const remote = remotes.find((r) => r.regexp.test(moduleId))
            if (remote) {
              const afterImportName = `__federation_var_${moduleId.replace(
                /[@/\\.-]/g,
                ''
              )}`
              const modName = `.${moduleId.slice(remote.id.length)}`
              switch (node.type) {
                case 'ImportDeclaration': {
                  if (!hasStaticImported.has(moduleId)) {
                    hasStaticImported.set(moduleId, afterImportName)
                    magicString.overwrite(
                      node.start,
                      node.end,
                      `const ${afterImportName} = await __federation_method_getRemote(${str(
                        remote.id
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
                      `const ${afterImportName} = await __federation_method_getRemote(${str(
                        remote.id
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

          const shared = context.shared.find(
            (sharedInfo) => sharedInfo[0] === moduleId
          )

          if (shared) {
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
                  const line = `const ${afterImportName} = await __federation_method_importShared(${str(
                    moduleId
                  )}, ${str(shared[1].shareScope)});\n`
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
                  )}, ${str(shared[1].shareScope)});\n`
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
                  `\nexport {${exportContent.slice(
                    0,
                    exportContent.length - 1
                  )}}; `
                )
                break
              }
            }
          }
        })
      )
    },
    Import({ container }) {
      const moduleId = container.arguments[0].value
      if (!moduleId) return

      if (moduleId.indexOf('/') > -1) {
        const remote = remotes.find((r) => r.regexp.test(moduleId))
        if (remote) {
          const modName = `.${moduleId.slice(remote.id.length)}`
          magicString.overwrite(
            container.start,
            container.end,
            `__federation_method_getRemote(${str(remote.id)} , ${str(modName)})`
          )
          hasGetRemote = true
        }
      }
      const shared = context.shared.find(
        (sharedInfo) => sharedInfo[0] === moduleId
      )

      if (shared) {
        magicString.overwrite(
          container.start,
          container.end,
          `__federation_method_importShared(${str(moduleId)}, ${str(
            shared[1].shareScope
          )})`
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
    }
  })

  await Promise.all(promises)

  const sources = Object.keys(sourceLocalNamesMap)
  if (sources.length || optimizeNodes.length) {
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

        optimizeNodes.forEach((optimizeNode) => {
          const name = optimizeNode.declarations[0].id.name
          path.scope.bindings[name].referencePaths.forEach((referencePath) => {
            if (referencePath.parentPath.node.type === 'ExportSpecifier') {
              magicString.appendRight(
                optimizeNode.end,
                `\nconst __federation_import_${name} = await ${referencePath.node.name}();\nconst __federation_export_${name} = () => __federation_import_${name};`
              )
              const container = referencePath.container
              if (
                container.local.name === container.exported.name &&
                container.local.start === container.exported.start &&
                container.local.end === container.exported.end
              ) {
                // export { require_vue }
                magicString.overwrite(
                  referencePath.node.start,
                  referencePath.node.end,
                  `__federation_export_${name} as ${referencePath.node.name}`
                )
              } else {
                // export { require_vue as xxx }
                magicString.overwrite(
                  referencePath.node.start,
                  referencePath.node.end,
                  `__federation_export_${name}`
                )
              }
            } else if (
              // export require_vue()
              referencePath.parentPath.node.type === 'CallExpression'
            ) {
              magicString.overwrite(
                referencePath.node.start,
                referencePath.node.end,
                `await ${referencePath.node.name}`
              )
            }
          })
        })
      }
    })
  }

  if (hasGetRemote) {
    magicString.prepend(
      `import { getRemote as __federation_method_getRemote } from '__federation_host';\n`
    )
  }

  if (hasImportRef) {
    magicString.prepend(
      `import { importRef as __federation_method_importRef } from '__federation_utils';\n`
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

function searchPackageJSON(dir: string) {
  let packageJsonPath: string
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!dir) return
    const newDir = dirname(dir)
    if (newDir === dir) return
    dir = newDir
    packageJsonPath = join(dir, 'package.json')
    if (existsSync(packageJsonPath)) break
  }
  return packageJsonPath
}
