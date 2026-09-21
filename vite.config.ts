import { builtinModules } from "node:module";
import { defineConfig } from "vite-plus";

const sourceImports = {
  group: ["**/src/**"],
  message: "Import workspace packages through their declared exports.",
};

const electronImports = ["electron", "electron/*", "@electron-forge/*"];
const iconImports = {
  group: ["lucide-react", "lucide-react/*"],
  message: "Import icons from @stargeist/ui/icons.",
};
const platformImports = [
  "node:*",
  ...electronImports,
  "@stargeist/database",
  "@stargeist/database/*",
  "@effect/sql-*",
];
const appImports = [
  "@stargeist/renderer",
  "@stargeist/renderer/*",
  "@stargeist/desktop",
  "@stargeist/desktop/*",
  "@stargeist/dev-tools",
  "@stargeist/dev-tools/*",
];
const featureImports = [
  "@stargeist/domain",
  "@stargeist/domain/*",
  "@stargeist/ui",
  "@stargeist/ui/*",
];
const uiImports = [
  ...appImports,
  "@stargeist/domain",
  "@stargeist/domain/*",
  "@stargeist/application",
  "@stargeist/application/*",
];

const boundaries = [
  {
    files: ["tooling/dev/src/**"],
    portable: false,
    patterns: appImports,
  },
  {
    files: ["apps/sg-renderer/src/**"],
    portable: true,
    patterns: [...appImports, iconImports],
  },
  {
    files: ["apps/sg-desktop/src/**"],
    portable: false,
    patterns: [...appImports, iconImports],
  },
  {
    files: ["packages/std/src/**"],
    portable: true,
    patterns: [
      ...appImports,
      ...featureImports,
      iconImports,
      "@stargeist/application",
      "@stargeist/application/*",
    ],
  },
  {
    files: ["packages/application/src/**"],
    portable: true,
    patterns: [...appImports, ...featureImports, iconImports],
  },
  {
    files: ["packages/ui/src/**"],
    portable: true,
    patterns: [...uiImports, iconImports],
  },
  {
    files: ["packages/ui/src/icons/index.tsx"],
    portable: true,
    patterns: uiImports,
  },
  {
    files: ["packages/domain/src/**"],
    portable: true,
    patterns: [...appImports, "@stargeist/ui", "@stargeist/ui/*", iconImports],
  },
  {
    files: ["packages/database/src/**"],
    portable: false,
    patterns: [
      ...appImports,
      ...electronImports,
      iconImports,
      "@stargeist/ui",
      "@stargeist/ui/*",
      "@stargeist/application",
      "@stargeist/application/*",
    ],
  },
];

export default defineConfig({
  staged: {
    "*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}": "vp check --fix --no-error-on-unmatched-pattern",
    "*.{json,jsonc,md,mdx,yaml,yml,css,scss,html}": "vp fmt --no-error-on-unmatched-pattern",
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["**/dist/**", "**/out/**", "**/.vite/**", "**/.generated/**", ".agents/**"],
    overrides: boundaries.flatMap(({ files, portable, patterns }) => [
      {
        files,
        rules: {
          "no-restricted-imports": ["error", { patterns: [sourceImports, ...patterns] }],
          curly: files[0]?.startsWith("tooling/") ? "error" : "off",
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
  test: {
    include: ["packages/**/*.test.ts", "apps/*/src/**/*.test.ts", "tooling/*/src/**/*.test.ts"],
  },
});
