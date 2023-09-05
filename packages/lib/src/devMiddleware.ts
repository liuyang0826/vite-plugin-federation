import type { Context } from 'types'
import type { Connect } from 'vite'
import { importQueryRE } from './constants'

export default function devMiddleware(
  context: Context
): Connect.NextHandleFunction {
  const {
    base,
    build: { assetsDir }
  } = context.viteConfig!
  const entryURL = `${base}${assetsDir ? assetsDir + '/' : ''}${
    context.filename
  }`
  return function (req, res, next) {
    if (importQueryRE.test(req.url!)) {
      const end = res.end
      res.end = function (content, ...args) {
        return end.call(
          this,
          typeof content === 'string'
            ? content.replace(
                'export default ',
                'export default new URL(import.meta.url).origin + '
              )
            : content,
          // eslint-disable-next-line
          // @ts-ignore
          ...args
        )
      }
      return next()
    }

    if (req.url !== entryURL) return next()

    res.writeHead(302, {
      Location: '/@id/__x00__virtual:__federation_remote',
      'Access-Control-Allow-Origin': '*'
    })
    res.end()
  }
}
