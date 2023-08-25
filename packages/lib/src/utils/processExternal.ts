import type { InputOptions } from 'rollup'
import type { Context } from 'types'
import { removeNonRegLetter } from '.'
import { NAME_CHAR_REG } from '../constants'

export default function processExternal(
  context: Context,
  inputOptions: InputOptions
) {
  const shareName2Prop = (context.shareName2Prop = new Map<string, any>())
  context.shared.forEach((value) =>
    shareName2Prop.set(removeNonRegLetter(value[0], NAME_CHAR_REG), value[1])
  )

  if (shareName2Prop.size) {
    // remove item which is both in external and shared
    inputOptions.external = (inputOptions.external as [])?.filter((item) => {
      return !shareName2Prop.has(removeNonRegLetter(item, NAME_CHAR_REG))
    })
  }

  return inputOptions
}
