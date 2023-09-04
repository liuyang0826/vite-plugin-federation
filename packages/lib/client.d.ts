import type { RemotesConfig } from './types'

declare module '~federation' {
  function setRemote(remoteName: string, remoteConfig: RemotesConfig): void
  function getRemote(remoteName: string, componentName: string): Promise<any>
  export { getRemote, setRemote }
}
