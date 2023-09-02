import type { Context } from 'types'
import type { Connect } from 'vite'
import { extname } from 'node:path'
import dtsBuilder from './dtsBuilder'

export default async function dtsMiddleware(
  context: Context
): Promise<Connect.NextHandleFunction | null> {
  if (
    !context.expose.some((item) => item[1].types) ||
    !context.existsTypescript
  )
    return null

  const {
    base,
    build: { assetsDir }
  } = context.viteConfig!

  const entryURL = `${base}${
    assetsDir ? assetsDir + '/' : ''
  }${context.filename.replace(extname(context.filename), '.d.json')}`

  return async (req, res, next) => {
    if (req.url !== entryURL) return next()
    const body = await dtsBuilder(context)
    res.writeHead(200, {
      'Content-Type': 'application/json'
    })
    res.end(JSON.stringify(body, null, 2))
  }
}
