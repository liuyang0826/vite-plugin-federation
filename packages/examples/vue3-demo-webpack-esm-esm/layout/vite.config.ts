import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@liuyang0826/vite-plugin-federation'

// https://vitejs.dev/config/
export default defineConfig({
  cacheDir: 'node_modules/.cacheDir',
  base: "http://127.0.0.1:5000",
  plugins: [
    vue(),
    federation({
      name: 'layout',
      filename: 'remoteEntry.js',
      remotes: {
        home: {
          external: 'http://localhost:5001/remoteEntry.js',
          format: 'esm'
        }
      },
      exposes: {
        './Button': {
          name: 'button',
          import: './src/components/UnusedButton.vue'}
      },
      shared: ['vue', 'pinia']
    })
  ],
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        format: 'esm',
        entryFileNames: 'assets/[name].js',
        minifyInternalExports: false
      }
    }
  }
})
