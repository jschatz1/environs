import { defineConfig } from "vite";
import { resolve } from "path";

const src = (...parts) => resolve(__dirname, "../src", ...parts);

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: [
      // More specific aliases first so they match before the bare "environs"
      {
        find: "environs/jsx-dev-runtime",
        replacement: src("rendering/jsx-runtime.ts"),
      },
      {
        find: "environs/jsx-runtime",
        replacement: src("rendering/jsx-runtime.ts"),
      },
      {
        find: "environs",
        replacement: src("index.ts"),
      },
    ],
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "environs",
  },
});
