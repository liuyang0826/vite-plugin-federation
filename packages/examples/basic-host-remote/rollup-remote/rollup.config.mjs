import federation from '@liuyang0826/vite-plugin-federation';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: "src/index.js",
  plugins: [
    // nodeResolve(),
    federation({
      filename: "remoteEntry.js",
      exposes: {
        "./Button": "./src/button"
      }
    }),
  ],
  output: {
    format: "esm",
    dir: "dist"
  },
};
