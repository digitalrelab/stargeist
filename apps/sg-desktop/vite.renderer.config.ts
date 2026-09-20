import { fileURLToPath } from "node:url";
import webConfig from "@stargeist/web/vite";
import { defineConfig, mergeConfig } from "vite-plus";

export default defineConfig(
  mergeConfig(webConfig, {
    base: "./",
    build: {
      outDir: fileURLToPath(new URL(".vite/renderer/main_window", import.meta.url)),
      emptyOutDir: true,
    },
  }),
);
