import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, onTestFinished } from "vite-plus/test";
import { identifyDirectory } from "./identity";

it("isolates checkouts while resolving alternate paths to the same identity", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "stargeist identity ")));
  const first = join(root, "first");
  const second = join(root, "second");
  const alias = join(root, "alias");

  mkdirSync(first);
  mkdirSync(second);
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));

  symlinkSync(first, alias, process.platform === "win32" ? "junction" : "dir");

  expect(identifyDirectory(alias)).toEqual(identifyDirectory(first));
  expect(identifyDirectory(first).identity).not.toBe(identifyDirectory(second).identity);
});
