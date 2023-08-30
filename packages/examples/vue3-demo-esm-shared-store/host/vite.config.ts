import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@liuyang0826/vite-plugin-federation'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vitejs.dev/config/
export default defineConfig({
    server: {
    },
    cacheDir: 'node_modules/.cacheDir',
    plugins: [
        vue(),
        federation({
            name: 'layout',
            filename: 'remoteEntry.js',
            remotes: {
                remoteA: {
                    external: `Promise.resolve('http://localhost:5001/assets/remoteEntry.js')`,
                    externalType: "promise"
                },
                remoteB: {
                    external: `Promise.resolve('http://localhost:5002/assets/remoteEntry.js')`,
                    externalType: "promise"
                },
            },
            shared: {
                vue:{
                    // This is an invalid configuration, because the generate attribute is not supported on the host side
                    // generate:false
                },
                pinia:{
                },
                myStore: {
                    packagePath: './src/store.js'
                }
            }
        }),
        topLevelAwait(),
    ],
    base: "http://127.0.0.1:5000",
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
