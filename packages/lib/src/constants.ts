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

export const DEFAULT_DTS = 'federation.d.ts'
export const DEFAULT_ENTRY_FILENAME = 'remoteEntry.js'
export const NAME_CHAR_REG = new RegExp('[0-9a-zA-Z@_-]+')
export const importQueryRE = /(\?|&)import=?(?:&|$)/
// Custom json filter for vite
export const jsonExtRE = /\.json(?:$|\?)(?!commonjs-(?:proxy|external))/
export const SPECIAL_QUERY_RE = /[?&](?:worker|sharedworker|raw|url)\b/
