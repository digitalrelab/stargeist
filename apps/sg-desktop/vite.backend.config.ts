import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    target: "node24",
    lib: { entry: "src/backend/main.ts", formats: ["cjs"], fileName: () => "backend.js" },
  },
});
