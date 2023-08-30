import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
import federation from '@liuyang0826/vite-plugin-federation'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import ElementPlus from 'unplugin-element-plus/vite'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    legacy({
      targets: ['chrome 62', 'not IE 11'],
      renderModernChunks: false,
    }),
    topLevelAwait(),
    ElementPlus(),
    // cssInjectedByJsPlugin(),
    vue(),
    federation({
      name: 'team-blue',
      filename: 'remoteEntry-legacy.js',
      exposes: {
          './BasketInfo': './src/components/BasketInfo.vue',
          './BuyButton': './src/components/BuyButton.vue',
      },
      shared: ['vue', 'pinia']
    })
  ],
  esbuild: {
    target: "es2015"
  },
  build: {
    minify: false,
    // target: ["chrome89", "edge89", "firefox89", "safari15"],
    
    // modulePreload: false
 }
})
