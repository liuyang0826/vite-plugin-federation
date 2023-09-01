import { rollup } from 'rollup'
import { dts } from 'rollup-plugin-dts'
import type { Context } from 'types'

export default async function dtsBuilder(context: Context) {
  const build = await rollup({
    plugins: [dts()],
    input: context.expose
      .filter((item) => item[1].types)
      .map((item) => item[1].types) as string[]
  })

  const { output: outputs } = await build.generate({ format: 'esm' })
  const body: { name: string; code: string }[] = []

  outputs.forEach((output, index) => {
    if (output.type === 'chunk') {
      body.push({ name: context.expose[index][0], code: output.code })
    }
  })

  return JSON.stringify(body, null, 2)
}
