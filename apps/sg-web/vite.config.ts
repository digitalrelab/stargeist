import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import stylex from "@stylexjs/unplugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const developmentSocketOrigin = process.env.PORTLESS_URL
  ? new URL(process.env.PORTLESS_URL).origin.replace(/^http/, "ws")
  : "ws://localhost:*";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    stylex.vite({
      useCSSLayers: { before: ["reset"] },
      unstable_moduleResolution: {
        type: "commonJS",
        rootDir: fileURLToPath(new URL("../..", import.meta.url)),
      },
    }),
    react(),
    {
      name: "stargeist-license",
      async generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "LICENSE",
          source: await readFile(new URL("../../LICENSE", import.meta.url), "utf8"),
        });
      },
    },
    {
      name: "stargeist-content-security-policy",
      transformIndexHtml: (_html, context) => [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: [
              "default-src 'self'",
              context.server ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              context.server
                ? `connect-src 'self' ${developmentSocketOrigin}`
                : "connect-src 'self'",
              "img-src 'self' data:",
              "object-src 'none'",
              "base-uri 'none'",
            ].join("; "),
          },
          injectTo: "head-prepend",
        },
      ],
    },
  ],
  resolve: { dedupe: ["react", "react-dom"], preserveSymlinks: false },
  server: { host: "localhost" },
  build: { target: "esnext" },
});
