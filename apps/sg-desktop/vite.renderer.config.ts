import { fileURLToPath } from "node:url";
import rendererConfig from "@stargeist/renderer/vite";
import { defineConfig, mergeConfig } from "vite-plus";

export default defineConfig(
  mergeConfig(rendererConfig, {
    base: "./",
    build: {
      outDir: fileURLToPath(new URL(".vite/renderer/main_window", import.meta.url)),
      emptyOutDir: true,
    },
  }),
);
