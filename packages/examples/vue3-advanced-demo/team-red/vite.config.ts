import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from "@liuyang0826/vite-plugin-federation"
import ElementPlus from 'unplugin-element-plus/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: "/base/",
  plugins: [
    ElementPlus(),
    vue(),
    federation({
      name: 'team-red',
      remotes: {
        "team-blue": {
          external: "http://localhost:5002/assets/remoteEntry-legacy.js",
          format: "systemjs"
        },
        "team-green": "/remote-green/assets/remoteEntry.js",
      },
      shared: ['vue','pinia']
  })
  ],
  server: {
    fs: {
      allow: ["../../../../"]
    },
    proxy: {
      '/remote-green': {
        target:"http://localhost:5001",
        rewrite: path => path.replace('/remote-green', '')
      }
    }
  },
  build:{
    minify:false,
    target: ["chrome89", "edge89", "firefox89", "safari15"],
    rollupOptions: {
      output: {
        format: 'system',
        entryFileNames: 'assets/[name].js',
        minifyInternalExports: false
      }
    }
  },
  optimizeDeps:{
    exclude: ["vue"]
  }
})
