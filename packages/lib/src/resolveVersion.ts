import { readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { ConfigTypeSet, Context } from 'types'
import { getPackageInfo } from 'local-pkg'
import type { PluginContext } from 'rollup'

export default async function resolveVersion(
  this: PluginContext,
  context: Context
) {
  const collectDirFn = (filePath: string, collect: string[]) => {
    const files = readdirSync(filePath)
    files.forEach((name) => {
      const tempPath = join(filePath, name)
      const isDir = statSync(tempPath).isDirectory()
      if (isDir) {
        collect.push(tempPath)
        collectDirFn(tempPath, collect)
      }
    })
  }

  const monoRepos: { arr: string[]; root: string | ConfigTypeSet }[] = []
  const dirPaths: string[] = []
  const currentDir = resolve()

  //  try to get every module package.json file
  for (const arr of context.shared) {
    if (!arr[1].version && arr[1].packagePath === arr[0]) {
      let packageJson
      try {
        packageJson = (await getPackageInfo(arr[0]))?.packageJson
      } catch {
        /* noop */
      }
      if (packageJson) {
        arr[1].version = packageJson.version
      } else {
        arr[1].removed = true
        const dir = join(currentDir, 'node_modules', arr[0])
        const dirStat = statSync(dir)
        if (dirStat.isDirectory()) {
          collectDirFn(dir, dirPaths)
        } else {
          this.error(`cant resolve "${arr[1].packagePath}"`)
        }

        if (dirPaths.length > 0) {
          monoRepos.push({ arr: dirPaths, root: arr })
        }
      }

      if (!arr[1].removed && !arr[1].version) {
        this.error(
          `No description file or no version in description file (usually package.json) of ${arr[0]}. Add version to description file, or manually specify version in shared config.`
        )
      }
    }
  }

  context.shared = context.shared.filter((item) => !item[1].removed)
  // assign version to monoRepo
  if (monoRepos.length > 0) {
    for (const monoRepo of monoRepos) {
      for (const id of monoRepo.arr) {
        try {
          const idResolve = await this.resolve(id)
          if (idResolve?.id) {
            (context.shared as any[]).push([
              `${monoRepo.root[0]}/${basename(id)}`,
              {
                id: idResolve?.id,
                import: monoRepo.root[1].import,
                shareScope: monoRepo.root[1].shareScope,
                root: monoRepo.root
              }
            ])
          }
        } catch (e) {
          //    ignore
        }
      }
    }
  }
}
