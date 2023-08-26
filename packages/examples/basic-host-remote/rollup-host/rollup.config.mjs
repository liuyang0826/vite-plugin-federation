import federation from "@liuyang0826/vite-plugin-federation";

export default {
  input: "src/index.js",
  preserveEntrySignatures: false,
  plugins: [
    federation({
      remotes: {
        remote_app: "http://localhost:5001/remoteEntry.js",
      }
    }),
  ],
  output: [{ format: "esm", dir: "dist" }],
};
