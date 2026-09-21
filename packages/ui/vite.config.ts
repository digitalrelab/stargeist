import { fileURLToPath } from "node:url";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    stylex.vite({
      useCSSLayers: { before: ["reset"] },
      unstable_moduleResolution: {
        type: "commonJS",
        rootDir: fileURLToPath(new URL("../..", import.meta.url)),
      },
    }),
  ],
  resolve: { dedupe: ["react", "react-dom"], preserveSymlinks: false },
});
