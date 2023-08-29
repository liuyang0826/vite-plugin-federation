import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@liuyang0826/vite-plugin-federation'
import topLevelAwait from 'vite-plugin-top-level-await'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        topLevelAwait({
            // The export name of top-level await promise for each chunk module
            promiseExportName: "__tla",
            // The function to generate import names of top-level await promise in each chunk module
            promiseImportName: i => `__tla_${i}`
        }),
        federation({
            name: 'home',
            filename: 'remoteEntry.js',
            exposes: {
                './Button': './src/components/Button.vue'
            },
            shared: {
                vue: {},
                pinia: {},
                myStore: {
                    packagePath: './src/store.js',
                    import: false,
                    generate: false
                }
            }
        })
    ],
    base: "http://127.0.0.1:5001",
    build: {
        assetsInlineLimit: 40960,
        minify: false,
        cssCodeSplit: false,
        sourcemap: true,
        rollupOptions: {
            output: {
                minifyInternalExports: false
            }
        }
    }
})
