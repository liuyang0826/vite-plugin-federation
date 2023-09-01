import { readFileSync } from 'node:fs'
import type { Plugin } from 'esbuild'
import { OPTIMIZE_DEPS_NAMESPACE, OPTIMIZE_LOCAL_SUFFIX } from './constants'
import { resolveModule } from 'local-pkg'
import { dirname, join } from 'node:path'
import type { Context } from 'types'

export default function optimizeDepsPlugin(context: Context): Plugin {
  return {
    name: OPTIMIZE_DEPS_NAMESPACE,
    setup(build) {
      const shareds = context.shared

      build.onResolve(
        {
          filter: new RegExp(
            '^(' +
              shareds.map((item) => item[0]).join('|') +
              ')(\\' +
              OPTIMIZE_LOCAL_SUFFIX +
              ')?$'
          )
        },
        (args) => ({
          path: args.path,
          namespace: OPTIMIZE_DEPS_NAMESPACE
        })
      )
      build.onLoad(
        {
          filter: /.*/,
          namespace: OPTIMIZE_DEPS_NAMESPACE
        },
        (args) => {
          if (args.path.endsWith(OPTIMIZE_LOCAL_SUFFIX)) {
            const shared = context.shared.find(
              (item) =>
                item[0] === args.path.slice(0, -OPTIMIZE_LOCAL_SUFFIX.length)
            )!
            if (shared[0] === shared[1].packagePath) {
              const path = resolveModule(shared[0])!
              return {
                contents: readFileSync(path, 'utf-8'),
                resolveDir: dirname(path)
              }
            }
            const path = join(process.cwd(), shared[1].packagePath!)
            return {
              contents: readFileSync(path, 'utf-8'),
              resolveDir: dirname(path)
            }
          }

          const contents = `
const { importSharedDev } = require('__federation_shared');
const local = () => require('${args.path}${OPTIMIZE_LOCAL_SUFFIX}');
module.exports = importSharedDev('${args.path}', '${
            shareds.find((item) => item[0] === args.path)![1].shareScope
          }', local)
          `
          return { contents }
        }
      )
    }
  }
}
