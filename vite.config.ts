import { builtinModules } from "node:module";
import { defineConfig } from "vite-plus";

const sourceImports = {
  group: ["**/src/**"],
  message: "Import workspace packages through their declared exports.",
};

const electronImports = ["electron", "electron/*", "electron-store", "@electron-forge/*"];
const iconImports = {
  group: ["lucide-react", "lucide-react/*"],
  message: "Import icons from @stargeist/ui.",
};
const platformImports = [
  "node:*",
  ...electronImports,
  "@stargeist/database",
  "@stargeist/database/*",
  "@stargeist/workspace-storage",
  "@stargeist/workspace-storage/*",
  "@effect/sql-*",
  "effect/unstable/sql",
  "effect/unstable/sql/*",
  "drizzle-orm",
  "drizzle-orm/*",
];
const appImports = [
  "@stargeist/checks",
  "@stargeist/checks/*",
  "@stargeist/renderer",
  "@stargeist/renderer/*",
  "@stargeist/desktop",
  "@stargeist/desktop/*",
  "@stargeist/dev-tools",
  "@stargeist/dev-tools/*",
];
const protocolImports = [
  "@stargeist/protocol",
  "@stargeist/protocol/*",
  "effect/unstable/rpc",
  "effect/unstable/rpc/*",
  "@stargeist/std/rpc",
];
const featureImports = [
  "@stargeist/protocol",
  "@stargeist/protocol/*",
  "@stargeist/domain",
  "@stargeist/domain/*",
  "@stargeist/ui",
  "@stargeist/ui/*",
];
const uiImports = [
  ...protocolImports,
  ...appImports,
  "@stargeist/domain",
  "@stargeist/domain/*",
  "@stargeist/application",
  "@stargeist/application/*",
];

const boundaries = [
  {
    files: ["tooling/checks/src/**"],
    portable: false,
    patterns: [...appImports, ...featureImports, "@stargeist/database", "@stargeist/database/*"],
  },
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
    files: ["apps/sg-desktop/src/backend/**"],
    portable: false,
    patterns: [
      ...appImports,
      iconImports,
      {
        group: ["../workspaces/*", "!../workspaces/host"],
        message: "Compose workspaces through its public backend and host entry points.",
      },
    ],
  },
  {
    files: [
      "apps/sg-desktop/src/backend/host.ts",
      "apps/sg-desktop/src/backend/process.ts",
      "apps/sg-desktop/src/backend/renderer.ts",
      "apps/sg-desktop/src/backend/port.ts",
    ],
    portable: false,
    patterns: [
      ...appImports,
      ...featureImports,
      iconImports,
      {
        group: [
          "../workspaces",
          "../workspaces/**",
          "../user-preferences",
          "../user-preferences/**",
          "../window",
          "../window/**",
        ],
        message:
          "Register capabilities at application composition; hosting must not import feature implementations.",
      },
    ],
  },
  {
    files: ["apps/sg-desktop/src/window/**"],
    portable: false,
    patterns: [
      ...appImports,
      iconImports,
      {
        group: ["../backend", "../backend/**"],
        message: "Windows depend on their connection contract, not backend process management.",
      },
    ],
  },
  {
    files: [
      "apps/sg-desktop/src/workspaces/service.ts",
      "apps/sg-desktop/src/workspaces/browser.ts",
      "apps/sg-desktop/src/workspaces/host.ts",
    ],
    portable: false,
    patterns: [...appImports, iconImports, "node:*", ...electronImports],
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
    patterns: [...appImports, ...featureImports, ...protocolImports, iconImports],
  },
  {
    files: ["packages/application/src/rpc.ts", "packages/application/src/rpc.test.ts"],
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
    patterns: [
      ...appImports,
      ...protocolImports,
      "@stargeist/application",
      "@stargeist/ui",
      "@stargeist/ui/*",
      iconImports,
    ],
  },
  {
    files: ["packages/protocol/src/**"],
    portable: true,
    patterns: [
      ...appImports,
      "@stargeist/application",
      "@stargeist/ui",
      "@stargeist/ui/*",
      iconImports,
    ],
  },
  {
    files: [
      "apps/sg-renderer/src/**/state.ts",
      "apps/sg-renderer/src/**/state.test.ts",
      "apps/sg-renderer/src/**/client.ts",
      "apps/sg-renderer/src/client/**",
      "apps/sg-renderer/src/routes/**",
      "apps/sg-renderer/src/**/*.tsx",
    ],
    portable: true,
    patterns: [...appImports, ...protocolImports, iconImports],
  },
  {
    files: ["packages/database/src/**", "packages/workspace-storage/src/**"],
    portable: false,
    patterns: [
      ...appImports,
      ...electronImports,
      ...protocolImports,
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
    overrides: boundaries.flatMap(({ files, portable, patterns }) => {
      let curly: "off" | "error" = "off";
      let paths: string[] = [];
      let restricted = [sourceImports, ...patterns];
      if (files[0]?.startsWith("tooling/")) curly = "error";
      if (portable) {
        paths = [...builtinModules];
        restricted = [...restricted, ...platformImports];
      }
      return [
        {
          files,
          rules: {
            "no-restricted-imports": ["error", { patterns: [sourceImports, ...patterns] }],
            curly,
          },
        },
        {
          files,
          excludeFiles: ["**/*.test.ts", "**/*.test.tsx"],
          rules: {
            "no-restricted-imports": [
              "error",
              {
                paths,
                patterns: restricted,
              },
            ],
          },
        },
      ];
    }),
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
