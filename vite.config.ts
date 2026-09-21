import { builtinModules } from "node:module";
import { defineConfig } from "vite-plus";

const sourceImports = {
  group: ["**/src/**"],
  message: "Import workspace packages through their declared exports.",
};

const electronImports = ["electron", "electron/*", "@electron-forge/*"];
const platformImports = [
  "node:*",
  ...electronImports,
  "@stargeist/database",
  "@stargeist/database/*",
  "@effect/sql-*",
];
const appImports = [
  "@stargeist/web",
  "@stargeist/web/*",
  "@stargeist/desktop",
  "@stargeist/desktop/*",
];
const featureImports = [
  "@stargeist/domain",
  "@stargeist/domain/*",
  "@stargeist/ui",
  "@stargeist/ui/*",
];

const boundaries = [
  {
    files: ["apps/sg-web/src/**"],
    portable: true,
    patterns: appImports,
  },
  {
    files: ["apps/sg-desktop/src/**"],
    portable: false,
    patterns: appImports,
  },
  {
    files: ["packages/std/src/**"],
    portable: true,
    patterns: [
      ...appImports,
      ...featureImports,
      "@stargeist/application",
      "@stargeist/application/*",
    ],
  },
  {
    files: ["packages/application/src/**"],
    portable: true,
    patterns: [...appImports, ...featureImports],
  },
  {
    files: ["packages/ui/src/**"],
    portable: true,
    patterns: [
      ...appImports,
      "@stargeist/domain",
      "@stargeist/domain/*",
      "@stargeist/application",
      "@stargeist/application/*",
    ],
  },
  {
    files: ["packages/domain/src/**"],
    portable: true,
    patterns: [...appImports, "@stargeist/ui", "@stargeist/ui/*"],
  },
  {
    files: ["packages/database/src/**"],
    portable: false,
    patterns: [
      ...appImports,
      ...electronImports,
      "@stargeist/ui",
      "@stargeist/ui/*",
      "@stargeist/application",
      "@stargeist/application/*",
    ],
  },
];

export default defineConfig({
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["**/dist/**", "**/out/**", "**/.vite/**", "**/.generated/**", ".agents/**"],
    overrides: boundaries.flatMap(({ files, portable, patterns }) => [
      {
        files,
        rules: {
          "no-restricted-imports": ["error", { patterns: [sourceImports, ...patterns] }],
        },
      },
      {
        files,
        excludeFiles: ["**/*.test.ts", "**/*.test.tsx"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: portable ? [...builtinModules] : [],
              patterns: [sourceImports, ...patterns, ...(portable ? platformImports : [])],
            },
          ],
        },
      },
    ]),
  },
  fmt: {
    ignorePatterns: [
      "**/dist/**",
      "**/out/**",
      "**/.vite/**",
      "**/.generated/**",
      ".agents/**",
      "skills-lock.json",
    ],
  },
  test: { include: ["packages/**/*.test.ts", "apps/*/src/**/*.test.ts"] },
});
