import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: ['./src/index.ts', 'src/semver/satisfy.ts'],
      formats: ['es', 'cjs']
    },
    target: 'node14',
    minify: false,
    rollupOptions: {
      external: [
        'node:fs',
        'node:path',
        'magic-string',
        '@babel/traverse',
        '@babel/parser',
        'local-pkg',
        '@rollup/pluginutils',
        '@rollup/plugin-virtual',
        'defu'
      ],
      output: {
        minifyInternalExports: false
      }
    }
  }
})
