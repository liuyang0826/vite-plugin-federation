import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@liuyang0826/vite-plugin-federation'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "viteRemote",
      filename: "remoteEntry.js",
      exposes: {
        './Button': './src/components/Button'
      },
      shared: ['react','react-dom']
    })
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false
  }
})
