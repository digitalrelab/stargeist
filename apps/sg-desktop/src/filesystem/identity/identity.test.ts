import { execFile } from "node:child_process";
import {
  copyFile,
  link,
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Effect } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { readFileIdentity, verifyFileIdentities } from "./index";
import { IdentityUnavailable } from "./errors";

const execute = promisify(execFile);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-file-identity-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "original.txt");
  await writeFile(path, "original");
  const file = await readFileIdentity(path);
  expect(file?.type).toBe("file");
  if (!file) throw new Error("Expected a file identity");
  return { root, path, file };
}

it("preserves identity through edits, timestamp changes, hard links, and same-volume moves", async () => {
  const { root, path, file } = await fixture();
  await writeFile(path, "edited");
  await utimes(path, new Date("2000-01-01"), new Date("2000-01-01"));
  const alias = join(root, "alias.txt");
  await link(path, alias);
  const folder = join(root, "nested");
  await mkdir(folder);
  const moved = join(folder, "renamed.txt");
  await rename(path, moved);
  for (const candidate of [alias, moved]) {
    const current = await readFileIdentity(candidate);
    expect(current?.objectKey).toBe(file.objectKey);
    expect(
      await Effect.runPromise(
        verifyFileIdentities([
          { previous: { source: "local", ...file }, current: { source: "local", ...current! } },
        ]),
      ),
    ).toEqual(["same"]);
  }
  expect(await readFileIdentity(path)).toBeNull();
});

it("distinguishes copies, atomic replacements, and deletion followed by recreation", async () => {
  const { root, path, file } = await fixture();
  const copy = join(root, "copy.txt");
  await copyFile(path, copy);
  const incoming = await readFileIdentity(copy);
  expect(incoming?.objectKey).not.toBe(file.objectKey);
  await rename(copy, path);
  expect((await readFileIdentity(path))?.objectKey).toBe(incoming?.objectKey);
  await rm(path);
  await writeFile(path, "original");
  const replacement = await readFileIdentity(path);
  expect(replacement?.objectKey).not.toBe(incoming?.objectKey);
});

it("identifies a link independently of its target and keeps folder identity through timestamp changes", async () => {
  const { root, path, file } = await fixture();
  const folder = await readFileIdentity(root);
  expect(folder?.type).toBe("folder");
  const alias = join(root, "link");
  await symlink(path, alias);
  const first = await readFileIdentity(alias);
  expect(first?.type).toBe("link");
  expect(first?.objectKey).not.toBe(file.objectKey);
  await rm(path);
  expect((await readFileIdentity(alias))?.objectKey).toBe(first?.objectKey);
  await utimes(root, new Date("2000-01-01"), new Date("2000-01-01"));
  expect((await readFileIdentity(root))?.objectKey).toBe(folder?.objectKey);
});

it("recognizes the same object in separate processes after it moves", async () => {
  const { root, path, file } = await fixture();
  const desktop = fileURLToPath(new URL("../../../", import.meta.url));
  const build = await mkdtemp(join(desktop, ".identity-test-"));
  onTestFinished(() => rm(build, { recursive: true, force: true }));
  const bundle = join(build, "identity.cjs");
  await execute("bun", [
    "build",
    fileURLToPath(new URL("./index.ts", import.meta.url)),
    "--target=node",
    "--format=cjs",
    "--external=koffi",
    "--outfile",
    bundle,
  ]);
  const read = async (candidate: string) => {
    const { stdout } = await execute(
      process.execPath,
      [
        "-e",
        "require(process.argv[1]).readFileIdentity(process.argv[2]).then(file => process.stdout.write(JSON.stringify(file)))",
        bundle,
        candidate,
      ],
      { cwd: dirname(bundle) },
    );
    return JSON.parse(stdout) as { objectKey: string };
  };
  expect((await read(path)).objectKey).toBe(file.objectKey);
  const moved = join(root, "moved.txt");
  await rename(path, moved);
  expect((await read(moved)).objectKey).toBe(file.objectKey);
}, 15_000);

it("rejects invalid paths before native string conversion", async () => {
  const { path } = await fixture();
  await expect(readFileIdentity(`${path}\0ignored`)).rejects.toBeInstanceOf(IdentityUnavailable);
});
