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

export const DYNAMIC_LOADING_CSS = 'dynamicLoadingCss'
export const DYNAMIC_LOADING_CSS_PREFIX = '__v__css__'
export const DEFAULT_ENTRY_FILENAME = 'remoteEntry.js'
export const DEFAULT_PROMIESE_EXPORT_NAME = '__tla'
export const sharedFilePathReg = /__federation_shared_(.+)\.js$/
export const NAME_CHAR_REG = new RegExp('[0-9a-zA-Z@_-]+')
export const COMMONJS_PROXY_SUFFIX = '?commonjs-proxy'
export const OPTIMIZE_SHARED_SUFFIX = '?federation_shared'
export const OPTIMIZE_LOCAL_SUFFIX = '?federation_local'
export const OPTIMIZE_DEPS_NAMESPACE = 'federation:optimize-deps'
