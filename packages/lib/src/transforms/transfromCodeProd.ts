import traverse from '@babel/traverse'
import type { ParseResult } from '@babel/parser'
import type { File } from '@babel/types'
import { parse } from '@babel/parser'
import type { Context } from 'types'
import MagicString from 'magic-string'
import type { Remote } from '../utils'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { COMMONJS_PROXY_SUFFIX } from '../constants'
import type { TransformPluginContext } from 'rollup'

export default async function transfromCodeProd(
  this: TransformPluginContext,
  context: Context,
  code: string,
  remotes: Remote[],
  id: string
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
    { localName: string; isDefault: boolean; isRequire?: boolean }[]
  > = {}
  let requiresRuntime = false
  let hasImportShared = false
  const modify = false
  const promises: Promise<void>[] = []

  traverse.default(ast, {
    enter: ({ node }: any) => {
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
          let isRequire = false
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
                  isRequire = true
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

          if (context.shared.some((sharedInfo) => sharedInfo[0] === moduleId)) {
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
                        isDefault: true,
                        isRequire
                      })
                    } else if (spec.type === 'ImportSpecifier') {
                      //  like import {a as b} from 'lib'
                      const localName = spec.local.name
                      sourceLocalNamesMap[afterImportName].push({
                        localName: localName,
                        isDefault: false,
                        isRequire
                      })
                      magicString.appendRight(
                        node.end,
                        `\nconst __federation_var_${localName} = '${spec.imported.name}';`
                      )
                    } else if (spec.type === 'ImportNamespaceSpecifier') {
                      //  like import * as a from 'lib'
                      sourceLocalNamesMap[afterImportName].push({
                        localName: spec.local.name,
                        isDefault: true,
                        isRequire
                      })
                    }
                  })
                }
                if (!hasStaticImported.has(moduleId)) {
                  hasStaticImported.set(moduleId, afterImportName)
                  if (isRequire) {
                    const line = `const ${afterImportName} = __federation_method_wrapRequire(await __federation_method_importShared(${JSON.stringify(
                      moduleId
                    )}));\n`
                    magicString.overwrite(node.start, node.end, line)
                  } else {
                    const line = `const ${afterImportName} = await __federation_method_importShared(${JSON.stringify(
                      moduleId
                    )});\n`
                    magicString.overwrite(node.start, node.end, line)
                  }
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
                    `const ${afterImportName} = __federation_method_importShared(${JSON.stringify(
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
        })
      )
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
          `__federation_method_importShared(${JSON.stringify(moduleId)})`
        )
        hasImportShared = true
      }
    }
  })

  await Promise.all(promises)

  const sources = Object.keys(sourceLocalNamesMap)
  if (sources.length) {
    traverse.default(ast, {
      Program(path) {
        sources.forEach((source) => {
          sourceLocalNamesMap[source].forEach(
            ({ localName, isDefault, isRequire }) => {
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
                        isRequire
                          ? source
                          : isDefault
                          ? `__federation_method_unwrapDefault(${source})`
                          : `__federation_method_importRef(${source}, __federation_var_${node.name})`
                      }`
                    )
                  } else if (container.type === 'NewExpression') {
                    magicString.overwrite(
                      node.start,
                      node.end,
                      isRequire
                        ? source
                        : isDefault
                        ? `(__federation_method_unwrapDefault(${source}))`
                        : `(__federation_method_importRef(${source}, __federation_var_${node.name}))`
                    )
                  } else {
                    magicString.overwrite(
                      node.start,
                      node.end,
                      isRequire
                        ? source
                        : isDefault
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
      `import { ensure as __federation_method_ensure, getRemote as __federation_method_getRemote, wrapDefault as __federation_method_wrapDefault, unwrapDefault as __federation_method_unwrapDefault, importRef as __federation_method_importRef, wrapRequire as __federation_method_wrapRequire } from '__federation_host';\n`
    )
  }

  if (hasImportShared) {
    magicString.prepend(
      `import { importShared as __federation_method_importShared } from '__federation_shared';\n`
    )
  }

  if (requiresRuntime || hasImportShared || modify) {
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
