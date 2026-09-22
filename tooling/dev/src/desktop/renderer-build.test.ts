import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { build, loadConfigFromFile, mergeConfig } from "vite";
import { expect, it } from "vite-plus/test";
import { checkout } from "../context";

it("initializes the compiled AI route and loads its page and pending component", async () => {
  const renderer = join(checkout, "apps", "sg-renderer");
  const config = await loadConfigFromFile(
    { command: "build", mode: "production" },
    join(renderer, "vite.config.ts"),
  );

  if (!config) {
    throw new Error("Missing renderer build configuration.");
  }

  const result = await build(
    mergeConfig(config.config, {
      configFile: false,
      logLevel: "silent",
      build: {
        write: false,
        minify: false,
        lib: {
          entry: join(renderer, "src/routes/settings/ai.tsx"),
          formats: ["cjs"],
          fileName: () => "route.cjs",
        },
        rolldownOptions: { output: { codeSplitting: false } },
      },
    }),
  );
  let bundles = [result];
  if (Array.isArray(result)) {
    bundles = result;
  }

  for (const bundle of bundles) {
    if (!("output" in bundle)) {
      throw new Error("Expected a completed renderer build.");
    }
    const entry = bundle.output.find((output) => output.type === "chunk" && output.isEntry);
    if (!entry || entry.type !== "chunk") {
      throw new Error("Missing compiled route.");
    }

    const child = promisify(execFile)(process.execPath, ["--input-type=commonjs"], {
      timeout: 10000,
    });
    child.child.stdin!.end(`${entry.code}
const assert = require("node:assert/strict");
const { component, pendingComponent } = exports.Route.options;
assert.equal(typeof component, "function");
assert.equal(typeof pendingComponent, "function");
Promise.all([component.preload(), pendingComponent.preload()]).then(() => {
  process.stdout.write("route-ready");
});
`);

    expect((await child).stdout).toBe("route-ready");
  }
}, 30000);
