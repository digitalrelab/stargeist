import { defineConfig } from "vite-plus";
import { desktopDevelopment } from "@stargeist/dev-tools/vite";

export default defineConfig(({ command }) => ({
  plugins: command === "serve" ? [desktopDevelopment("main", import.meta.dirname)] : [],
  build: { target: "node24" },
}));
