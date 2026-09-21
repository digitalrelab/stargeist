import { builtinModules } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, loadConfigFromFile, mergeConfig } from "vite";
import { expect, it } from "vite-plus/test";
import { checkout } from "../context";

const application = join(checkout, "apps", "sg-desktop");
const nativeAdapter = fileURLToPath(new URL("./native.cjs", import.meta.url));

it.each(["main", "backend"])(
  "keeps the %s development bootstrap loadable and excludes it from production",
  async (target) => {
    for (const command of ["serve", "build"] as const) {
      const config = await loadConfigFromFile(
        { command, mode: command === "serve" ? "development" : "production" },
        join(application, `vite.${target}.config.ts`),
      );

      if (!config) {
        throw new Error(`Missing desktop build configuration: ${target}`);
      }

      const result = await build(
        mergeConfig(config.config, {
          root: application,
          configFile: false,
          logLevel: "silent",
          define: {
            MAIN_WINDOW_VITE_DEV_SERVER_URL: "undefined",
            MAIN_WINDOW_VITE_NAME: JSON.stringify("main_window"),
          },
          build: {
            write: false,
            lib: {
              entry: join(application, target === "main" ? "src/main.ts" : "src/backend/main.ts"),
              formats: ["cjs"],
              fileName: () => `${target}.js`,
            },
            rollupOptions: {
              external: [
                "electron",
                ...builtinModules,
                ...builtinModules.map((name) => `node:${name}`),
              ],
            },
          },
        }),
      );

      const builds = Array.isArray(result) ? result : [result];

      for (const bundle of builds) {
        if (!("output" in bundle)) {
          throw new Error("Expected a completed desktop build.");
        }

        const entry = bundle.output.find((output) => output.type === "chunk" && output.isEntry);

        if (!entry || entry.type !== "chunk") {
          throw new Error("Missing desktop entry bundle.");
        }

        if (command === "serve") {
          expect(entry.imports).toContain(nativeAdapter);
          expect(entry.code).toContain("STARGEIST_DEV_APP_DATA");
        } else {
          expect(entry.imports).not.toContain(nativeAdapter);
          expect(entry.code).not.toContain("STARGEIST_DEV_APP_DATA");
          expect(entry.code).not.toContain("Stargeist-development");
          expect(entry.code).not.toContain("fs-native-extensions");
          expect(entry.code).not.toContain(checkout);
        }
      }
    }
  },
  30000,
);
