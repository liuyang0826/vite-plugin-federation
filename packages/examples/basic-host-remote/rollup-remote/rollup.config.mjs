import federation from '@liuyang0826/vite-plugin-federation';

export default {
  input: "src/index.js",
  plugins: [
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
