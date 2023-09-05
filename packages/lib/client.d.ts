declare module '~federation' {
  import type { RemotesConfig } from '@liuyang0826/vite-plugin-federation'
  function setRemote(remoteName: string, remoteConfig: RemotesConfig): void
  function getRemote(remoteName: string, componentName: string): Promise<any>
  export { getRemote, setRemote }
}
