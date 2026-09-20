import { builtinModules } from "node:module";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["**/dist/**", "**/out/**", "**/.vite/**", ".agents/**"],
    overrides: [
      {
        files: ["apps/sg-web/src/**", "packages/ui/src/**", "packages/std/src/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: [...builtinModules],
              patterns: ["node:*", "electron", "electron/*", "@electron-forge/*"],
            },
          ],
        },
      },
      {
        files: ["**/*.test.ts"],
        rules: { "no-restricted-imports": "off" },
      },
    ],
  },
  fmt: {
    ignorePatterns: ["**/dist/**", "**/out/**", "**/.vite/**", ".agents/**", "skills-lock.json"],
  },
  test: { include: ["packages/**/*.test.ts"] },
});
