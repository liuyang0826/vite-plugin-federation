import { rollup } from 'rollup'
import { dts } from 'rollup-plugin-dts'
import type { Context } from 'types'

export default async function dtsBuilder(context: Context) {
  try {
    const input = context.expose.filter((item) => item[1].types)
    if (!input.length) return []

    const build = await rollup({
      plugins: [dts()],
      input: input.map((item) => item[1].types!)
    })

    const { output: outputs } = await build.generate({ format: 'esm' })
    const body: { name: string; code: string }[] = []

    outputs.forEach((output, index) => {
      if (output.type === 'chunk') {
        body.push({ name: input[index][0], code: output.code })
      }
    })

    return body
  } catch {
    return []
  }
}
