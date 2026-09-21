import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

export function desktopDevelopment(
  process: "main" | "backend",
  applicationDirectory: string,
): Plugin {
  const entry = resolve(
    applicationDirectory,
    process === "main" ? "src/main.ts" : "src/backend/main.ts",
  );
  const bootstrap = fileURLToPath(new URL(`./${process}.ts`, import.meta.url));
  const native = fileURLToPath(new URL("./native.cjs", import.meta.url));

  return {
    name: "stargeist-desktop-development",
    enforce: "pre",

    config() {
      return {
        define: { STARGEIST_DESKTOP_DIRECTORY: JSON.stringify(applicationDirectory) },
      };
    },

    resolveId(source, importer) {
      if (importer && resolve(dirname(importer), source) === native) {
        return { id: native, external: "absolute" };
      }
    },

    transform(code, id) {
      if (resolve(id) !== entry) {
        return;
      }

      return {
        code: `import ${JSON.stringify(bootstrap)};\n${code}`,
        map: null,
      };
    },
  };
}
