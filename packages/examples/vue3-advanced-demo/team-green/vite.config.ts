import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@liuyang0826/vite-plugin-federation'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // cssInjectedByJsPlugin(),
    federation({
      name: 'team-green',
      filename: 'remoteEntry.js',
      exposes: {
          './Recommendations': {
            import: './src/components/Recommendations.vue',
            types: './temp/components/Recommendations.vue.d.ts',
          },
      },
      shared: ['vue', 'pinia']
    })
  ],
  build: {
    minify: false,
    target: ["chrome89", "edge89", "firefox89", "safari15"],
    rollupOptions: {
      output: {
        format: 'system',
      }
    }
 },
 optimizeDeps:{
   exclude: ["vue"]
 }
})
