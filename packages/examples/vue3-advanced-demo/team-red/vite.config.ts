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
        "team-blue": "http://localhost:5002/assets/remoteEntry.js",
        "team-green": "http://localhost:5001/assets/remoteEntry.js",
      },
      shared: ['vue','pinia']
  })
  ],
  build:{
    minify:false,
    target: ["chrome89", "edge89", "firefox89", "safari15"]
  }
})
