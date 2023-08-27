import { readFileSync } from 'node:fs'
import type { Plugin } from 'esbuild'
import { OPTIMIZE_DEPS_NAMESPACE, OPTIMIZE_LOCAL_SUFFIX } from '../constants'
import { resolveModule } from 'local-pkg'
import { dirname } from 'node:path'
import { Context } from 'types'

export default function optimizeDepsPlugin(context: Context): Plugin {
  return {
    name: OPTIMIZE_DEPS_NAMESPACE,
    setup(build) {
      const optimizeDepsExclude =
        context.viteConfigResolved.optimizeDeps.exclude
      const shareds = context.shared
      if (optimizeDepsExclude?.length) {
        shareds.filter((item) => !optimizeDepsExclude.includes(item[0]))
      }
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
            const path = resolveModule(
              args.path.slice(0, -OPTIMIZE_LOCAL_SUFFIX.length)
            )!
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
