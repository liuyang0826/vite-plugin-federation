import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@liuyang0826/vite-plugin-federation'

// https://vitejs.dev/config/
export default defineConfig({
    server: {
    },
    plugins: [
        vue(),
        federation({
            name: 'layout',
            filename: 'remoteEntry.js',
            remotes: {
                "remote-store": "http://localhost:5001/assets/remoteEntry.js"
            },
            shared: {
                vue:{
                },
                pinia:{
                }

            }
        })
    ],
    build: {
        target: 'esnext',
        minify: false,
        cssCodeSplit: true,
        rollupOptions: {
            output: {
                minifyInternalExports: false
            }
        }
    }
})
