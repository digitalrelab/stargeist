import { fileURLToPath } from "node:url";
import stylex from "@stylexjs/unplugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    stylex.vite({
      useCSSLayers: { before: ["reset"] },
      unstable_moduleResolution: {
        type: "commonJS",
        rootDir: fileURLToPath(new URL("../..", import.meta.url)),
      },
    }),
    react(),
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
              context.server ? "connect-src 'self' ws://localhost:*" : "connect-src 'self'",
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
