import { execFile } from "node:child_process";
import { link, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Effect, Schema } from "effect";
import koffi from "koffi";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { IdentityUnavailable, ObservationExpired } from "./errors";
import { verifyFileIdentities } from "./index";
import type { IdentityAdapter, NativeFile } from "./types";
import { createWindowsIdentity } from "./windows";

describe.skipIf(process.platform !== "win32")("Windows file recognition", () => {
  let directory: string;
  let adapter: IdentityAdapter;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "stargeist-windows-identity-"));
    adapter = createWindowsIdentity();
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function observe(path: string): Promise<NativeFile> {
    const file = await adapter.read(path);
    if (file === null) throw new Error("Expected the file to exist.");
    return file;
  }

  async function verify(previous: NativeFile, current: NativeFile) {
    if (adapter.verify === undefined) throw new Error("Expected identity verification.");
    return adapter.verify([
      {
        previous: { source: "local", ...previous },
        current: { source: "local", ...current },
      },
    ]);
  }

  const decode = Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Record(Schema.String, Schema.String)),
  );

  it("recognizes a surviving hard link after another link is removed", async () => {
    const original = join(directory, "original.txt");
    const remaining = join(directory, "remaining.txt");
    await writeFile(original, "content");
    const first = await observe(original);
    await link(original, remaining);
    await rm(original);
    const current = await observe(remaining);
    expect(current.objectKey).toBe(first.objectKey);
    expect(await verify(first, current)).toEqual(["same"]);
  });

  it("tracks a replacement as its own existing object", async () => {
    const original = join(directory, "original.txt");
    const replacement = join(directory, "replacement.txt");
    await writeFile(original, "before");
    await writeFile(replacement, "after");
    const before = await observe(original);
    const incoming = await observe(replacement);
    const kernel = koffi.load("kernel32.dll");
    const replaceFile = kernel.func(
      "int __stdcall ReplaceFileW(const char16_t *replaced, const char16_t *replacement, const char16_t *backup, uint32_t flags, void *exclude, void *reserved)",
    );
    expect(replaceFile(original, replacement, null, 0, null, null)).not.toBe(0);
    const after = await observe(original);
    expect(await verify(before, after)).toEqual(["different"]);
    expect(await verify(incoming, after)).toEqual(["same"]);
  });

  it("rejects observations older than the recorded checkpoint", async () => {
    const path = join(directory, "file.txt");
    await writeFile(path, "before");
    const before = await observe(path);
    await writeFile(path, "after");
    const after = await observe(path);
    await expect(verify(after, before)).rejects.toBeInstanceOf(ObservationExpired);
    expect(
      await Effect.runPromise(
        verifyFileIdentities([
          {
            previous: { source: "local", ...after },
            current: { source: "local", ...before },
          },
        ]).pipe(Effect.flip),
      ),
    ).toMatchObject({ code: "ObservationExpired" });
  });

  it("rejects synthetic evidence from another journal", async () => {
    const path = join(directory, "file.txt");
    await writeFile(path, "content");
    const current = await observe(path);
    const evidence = decode(current.evidence);
    const journalId = (BigInt(`0x${evidence.journalId}`) ^ 1n).toString(16).padStart(16, "0");
    const previous = {
      ...current,
      evidence: JSON.stringify({ ...evidence, journalId }),
    };
    await expect(verify(previous, current)).rejects.toBeInstanceOf(IdentityUnavailable);
  });

  it("rejects synthetic checkpoints beyond available journal history", async () => {
    const path = join(directory, "file.txt");
    await writeFile(path, "content");
    const current = await observe(path);
    const unavailable = {
      ...current,
      evidence: JSON.stringify({
        ...decode(current.evidence),
        checkpoint: "9223372036854775807",
      }),
    };
    await expect(verify(unavailable, unavailable)).rejects.toBeInstanceOf(IdentityUnavailable);
  });

  it("detects a real deletion when native ID reuse is simulated", async () => {
    const path = join(directory, "file.txt");
    await writeFile(path, "content");
    const before = await observe(path);
    await rm(path);
    const checkpoint = decode((await observe(directory)).evidence).checkpoint;
    const reused = {
      ...before,
      evidence: JSON.stringify({ ...decode(before.evidence), checkpoint }),
    };
    if (adapter.verify === undefined) throw new Error("Expected identity verification.");
    expect(
      await adapter.verify([
        {
          previous: { source: "local", ...before },
          current: { source: "local", ...reused },
        },
        {
          previous: { source: "local", ...reused },
          current: { source: "local", ...reused },
        },
      ]),
    ).toEqual(["different", "same"]);
  });

  it("retains deletion evidence after the file becomes unreadable", async () => {
    const username = process.env.USERNAME;
    if (username === undefined) throw new Error("Expected the Windows test account.");
    const path = join(directory, "unreadable.txt");
    await writeFile(path, "content");
    const before = await observe(path);
    const execute = promisify(execFile);
    await execute("icacls", [path, "/deny", `${username}:(RA,RD)`]);
    let deleted = false;
    try {
      await expect(adapter.read(path)).rejects.toBeInstanceOf(IdentityUnavailable);
      const kernel = koffi.load("kernel32.dll");
      const deleteFile = kernel.func("int __stdcall DeleteFileW(const char16_t *path)");
      expect(deleteFile(path)).not.toBe(0);
      deleted = true;
      const checkpoint = decode((await observe(directory)).evidence).checkpoint;
      const reused = {
        ...before,
        evidence: JSON.stringify({ ...decode(before.evidence), checkpoint }),
      };
      expect(await verify(before, reused)).toEqual(["different"]);
    } finally {
      if (!deleted) await execute("icacls", [path, "/remove:d", username]);
    }
  });
});
