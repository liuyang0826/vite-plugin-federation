import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@liuyang0826/vite-plugin-federation'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "remote_app",
      filename: "remoteEntry.js",
      exposes: {
        './Button': './src/components/Button'
      },
      shared: ['react','react-dom']
    })
  ],
  base: "http://127.0.0.1:5001",
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false
  }
})
