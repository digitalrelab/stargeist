import { defineConfig } from "vite-plus";
import { desktopDevelopment } from "@stargeist/dev-tools/vite";

export default defineConfig(({ command }) => ({
  plugins: command === "serve" ? [desktopDevelopment("backend", import.meta.dirname)] : [],
  build: {
    target: "node24",
    rolldownOptions: { external: ["koffi"] },
    lib: { entry: "src/backend/main.ts", formats: ["cjs"], fileName: () => "backend.js" },
  },
}));
