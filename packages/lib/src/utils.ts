// *****************************************************************************
// Copyright (C) 2022 Origin.js and others.
//
// This program and the accompanying materials are licensed under Mulan PSL v2.
// You can use this software according to the terms and conditions of the Mulan PSL v2.
// You may obtain a copy of Mulan PSL v2 at:
//          http://license.coscl.org.cn/MulanPSL2
// THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
// EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
// MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
// See the Mulan PSL v2 for more details.
//
// SPDX-License-Identifier: MulanPSL-2.0
// *****************************************************************************

import { dirname, posix, relative, win32 } from 'node:path'
import type { RemotesConfig } from '../types'

const letterReg = new RegExp('[0-9a-zA-Z]+')

export function removeNonRegLetter(str: string, reg = letterReg): string {
  let needUpperCase = false
  let ret = ''
  for (const c of str) {
    if (reg.test(c)) {
      ret += needUpperCase ? c.toUpperCase() : c
      needUpperCase = false
    } else {
      needUpperCase = true
    }
  }
  return ret
}

export type Remote = { id: string; regexp: RegExp; config: RemotesConfig }

export function createRemotesMap(remotes: Remote[]): string {
  const createUrl = (remote: Remote) => {
    const external = remote.config.external[0]
    const externalType = remote.config.externalType
    if (externalType === 'promise') {
      return `() => ${external}`
    } else {
      return `'${external}'`
    }
  }
  return remotes
    .map((remote) => {
      return `'${remote.id}': { url: ${createUrl(remote)}, format: '${
        remote.config.format
      }' }`
    })
    .join(',\n  ')
}

export function normalizePath(filename: string) {
  return filename.split(win32.sep).join(posix.sep)
}

export const str = JSON.stringify

export function toRelativePath(filename: string, importer: string) {
  const relPath = relative(dirname(importer), filename)
  return relPath[0] === '.' ? relPath : `./${relPath}`
}
