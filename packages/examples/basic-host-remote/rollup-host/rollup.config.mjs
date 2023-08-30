import federation from "@liuyang0826/vite-plugin-federation";
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: "src/index.js",
  preserveEntrySignatures: false,
  plugins: [
    nodeResolve(),
    federation({
      remotes: {
        remote_app: "http://localhost:5001/remoteEntry.js",
      }
    }),
  ],
  output: [{ format: "esm", dir: "dist" }],
};
