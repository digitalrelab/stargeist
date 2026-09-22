import { toNamespacedPath } from "node:path";
import type { FileIdentityComparison } from "@stargeist/domain";
import { Schema } from "effect";
import koffi, { type LibraryHandle } from "koffi";
import { IdentityUnavailable, ObservationExpired } from "./errors";
import type { IdentityAdapter, NativeFile } from "./types";

type Journal = {
  id: bigint;
  first: bigint;
  next: bigint;
  lowest: bigint;
};

type Comparison = {
  index: number;
  previous: ParsedEvidence;
  current: ParsedEvidence;
};

const volumePattern =
  /^\\\\\?\\Volume\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}\\$/i;
const Evidence = Schema.Struct({
  volume: Schema.String.check(Schema.isPattern(volumePattern)),
  serial: Schema.String.check(Schema.isPattern(/^[0-9a-f]{16}$/)),
  fileId: Schema.String.check(Schema.isPattern(/^[0-9a-f]{16}$/)),
  journalId: Schema.String.check(Schema.isPattern(/^[0-9a-f]{16}$/)),
  checkpoint: Schema.String.check(Schema.isPattern(/^(0|[1-9][0-9]{0,18})$/)),
});
type Evidence = typeof Evidence.Type;
type ParsedEvidence = Omit<Evidence, "checkpoint"> & { readonly checkpoint: bigint };
const decodeEvidence = Schema.decodeUnknownSync(Schema.fromJsonString(Evidence), {
  onExcessProperty: "error",
});
const maximumJournalSpan = 64n * 1024n * 1024n;
const journalBufferSize = 65_536;
const maximumJournalReads = Number(maximumJournalSpan / BigInt(journalBufferSize / 2)) + 1;
const maximumJournalRecords = Number(maximumJournalSpan / 64n) + journalBufferSize / 64;

function objectKey(evidence: Pick<Evidence, "volume" | "serial" | "fileId">): string {
  return `win32:${evidence.volume}:${evidence.serial}:${evidence.fileId}`;
}

function readEvidence(identity: FileIdentityComparison["current"]): ParsedEvidence {
  if (identity.source !== "local" || identity.evidence === null) {
    throw new IdentityUnavailable("File recognition information is unavailable.");
  }
  let parsed: Evidence;
  try {
    parsed = decodeEvidence(identity.evidence);
  } catch (cause) {
    throw new IdentityUnavailable("File recognition information is invalid.", { cause });
  }
  const checkpoint = BigInt(parsed.checkpoint);
  if (checkpoint > 0x7fff_ffff_ffff_ffffn) {
    throw new IdentityUnavailable("File recognition information is invalid.");
  }
  if (objectKey(parsed) !== identity.objectKey) {
    throw new IdentityUnavailable("File recognition information does not match.");
  }
  return { ...parsed, checkpoint };
}

function assertCoverage(journal: Journal, id: string, first: bigint, last: bigint): void {
  if (
    journal.id.toString(16).padStart(16, "0") !== id ||
    first < journal.first ||
    first < journal.lowest ||
    last > journal.next
  ) {
    throw new IdentityUnavailable("File history is no longer available.");
  }
}

export function createWindowsIdentity() {
  const kernel = koffi.load("kernel32.dll");
  const createFile = kernel.func(
    "intptr_t __stdcall CreateFileW(const char16_t *path, uint32_t access, uint32_t sharing, void *security, uint32_t disposition, uint32_t flags, intptr_t templateFile)",
  );
  const closeHandle = kernel.func("int __stdcall CloseHandle(intptr_t handle)");
  const lastError = kernel.func("uint32_t __stdcall GetLastError()");
  const getInformation = kernel.func(
    "int __stdcall GetFileInformationByHandleEx(intptr_t handle, int informationClass, void *information, uint32_t size)",
  );
  const getFileInformation = kernel.func(
    "int __stdcall GetFileInformationByHandle(intptr_t handle, void *information)",
  );
  const getFinalPath = kernel.func(
    "uint32_t __stdcall GetFinalPathNameByHandleW(intptr_t handle, void *path, uint32_t size, uint32_t flags)",
  );
  const getVolumeInformation = kernel.func(
    "int __stdcall GetVolumeInformationByHandleW(intptr_t handle, void *name, uint32_t nameSize, void *serial, void *maximumName, void *flags, void *filesystem, uint32_t filesystemSize)",
  );
  const deviceControl = kernel.func(
    "int __stdcall DeviceIoControl(intptr_t handle, uint32_t code, const void *input, uint32_t inputSize, void *output, uint32_t outputSize, void *returnedSize, void *overlapped)",
  );

  function invoke(native: ReturnType<LibraryHandle["func"]>, args: readonly unknown[]) {
    return new Promise<{ value: number | bigint; error: number }>((resolve, reject) => {
      native.async(...args, (failure: unknown, value: number | bigint) => {
        const error = Number(lastError());
        if (failure) {
          reject(failure);
          return;
        }
        resolve({ value, error });
      });
    });
  }

  async function open(path: string, access: number): Promise<bigint | null> {
    const result = await invoke(createFile, [path, access, 7, null, 3, 0x0220_0000, 0]);
    const handle = BigInt(result.value);
    if (handle !== -1n) return handle;
    if (result.error === 2 || result.error === 3 || result.error === 303) return null;
    throw new IdentityUnavailable("File recognition is unavailable.", {
      cause: { code: result.error },
    });
  }

  async function close(handle: bigint): Promise<void> {
    const result = await invoke(closeHandle, [handle]);
    if (result.value === 0) {
      throw new IdentityUnavailable("The file could not be closed.", {
        cause: { code: result.error },
      });
    }
  }

  async function information(handle: bigint, informationClass: number, size: number) {
    const buffer = Buffer.alloc(size);
    const result = await invoke(getInformation, [handle, informationClass, buffer, size]);
    if (result.value === 0) {
      throw new IdentityUnavailable("File recognition is unavailable.", {
        cause: { code: result.error },
      });
    }
    return buffer;
  }

  async function control(handle: bigint, code: number, input: Buffer | null, size: number) {
    const output = Buffer.alloc(size);
    const returned = Buffer.alloc(4);
    const result = await invoke(deviceControl, [
      handle,
      code,
      input,
      input?.length ?? 0,
      output,
      size,
      returned,
      null,
    ]);
    if (result.value === 0) {
      throw new IdentityUnavailable("File history is unavailable.", {
        cause: { code: result.error },
      });
    }
    const length = returned.readUInt32LE();
    if (length > output.length) throw new IdentityUnavailable("File history is invalid.");
    return output.subarray(0, length);
  }

  async function queryJournal(handle: bigint): Promise<Journal> {
    const output = await control(handle, 0x0009_00f4, null, 80);
    if (output.length < 56) throw new IdentityUnavailable("File history is invalid.");
    const journal = {
      id: output.readBigUInt64LE(0),
      first: output.readBigInt64LE(8),
      next: output.readBigInt64LE(16),
      lowest: output.readBigInt64LE(24),
    };
    if (journal.first < 0n || journal.lowest < 0n || journal.next < journal.first) {
      throw new IdentityUnavailable("File history is invalid.");
    }
    return journal;
  }

  async function openVolume(volume: string, serial: string): Promise<bigint> {
    const handle = await open(volume, 0x8000_0000);
    if (handle === null) throw new IdentityUnavailable("The drive is unavailable.");
    try {
      const id = await information(handle, 18, 24);
      if (id.readBigUInt64LE().toString(16).padStart(16, "0") !== serial) {
        throw new IdentityUnavailable("The drive has changed.");
      }
      return handle;
    } catch (error) {
      await close(handle);
      throw error;
    }
  }

  async function read(path: string): Promise<NativeFile | null> {
    const handle = await open(toNamespacedPath(path), 0x80);
    if (handle === null) return null;
    try {
      const filesystem = Buffer.alloc(64);
      const result = await invoke(getVolumeInformation, [
        handle,
        null,
        0,
        null,
        null,
        null,
        filesystem,
        32,
      ]);
      if (result.value === 0 || filesystem.toString("utf16le").split("\0")[0] !== "NTFS") {
        throw new IdentityUnavailable("This drive cannot reliably recognize files.");
      }
      const id = await information(handle, 18, 24);
      const fileInformation = Buffer.alloc(52);
      const fileResult = await invoke(getFileInformation, [handle, fileInformation]);
      if (fileResult.value === 0) {
        throw new IdentityUnavailable("The file could not be recognized.");
      }
      const fileId = Buffer.alloc(8);
      fileId.writeUInt32LE(fileInformation.readUInt32LE(48), 0);
      fileId.writeUInt32LE(fileInformation.readUInt32LE(44), 4);
      let name = Buffer.alloc(1024);
      let finalPath = await invoke(getFinalPath, [handle, name, name.length / 2, 9]);
      let length = Number(finalPath.value);
      if (length >= name.length / 2 && length < 32_768) {
        name = Buffer.alloc((length + 1) * 2);
        finalPath = await invoke(getFinalPath, [handle, name, name.length / 2, 9]);
        length = Number(finalPath.value);
      }
      if (length === 0 || length >= name.length / 2) {
        throw new IdentityUnavailable("The drive could not be recognized.");
      }
      const volume =
        name
          .subarray(0, length * 2)
          .toString("utf16le")
          .split("\\")
          .slice(0, 4)
          .join("\\") + "\\";
      if (!volumePattern.test(volume)) {
        throw new IdentityUnavailable("This drive cannot reliably recognize files.");
      }
      const serial = id.readBigUInt64LE().toString(16).padStart(16, "0");
      const volumeHandle = await openVolume(volume, serial);
      let journal: Journal;
      try {
        journal = await queryJournal(volumeHandle);
      } finally {
        await close(volumeHandle);
      }
      const standard = await information(handle, 1, 24);
      if (standard.readUInt32LE(16) === 0 || standard[20] !== 0) return null;
      const evidence: Evidence = {
        volume: volume.toLowerCase(),
        serial,
        fileId: fileId.toString("hex"),
        journalId: journal.id.toString(16).padStart(16, "0"),
        checkpoint: journal.next.toString(),
      };
      const attributes = fileInformation.readUInt32LE();
      let type: NativeFile["type"] = "file";
      if ((attributes & 0x10) !== 0) type = "folder";
      if ((attributes & 0x400) !== 0) {
        const tag = (await information(handle, 9, 8)).readUInt32LE(4);
        if (tag === 0xa000_000c || tag === 0xa000_0003) type = "link";
      }
      return { objectKey: objectKey(evidence), type, evidence: JSON.stringify(evidence) };
    } finally {
      await close(handle);
    }
  }

  async function verifyGroup(
    comparisons: readonly Comparison[],
    results: ("same" | "different")[],
  ): Promise<void> {
    const initial = comparisons[0];
    if (initial === undefined) return;
    let first = initial.previous.checkpoint;
    let last = initial.current.checkpoint;
    const candidates = new Map<string, Comparison[]>();
    for (const comparison of comparisons) {
      const start = comparison.previous.checkpoint;
      const end = comparison.current.checkpoint;
      if (start < first) first = start;
      if (end > last) last = end;
      const existing = candidates.get(comparison.previous.fileId);
      if (existing === undefined) candidates.set(comparison.previous.fileId, [comparison]);
      else existing.push(comparison);
    }
    if (last - first > maximumJournalSpan) {
      throw new IdentityUnavailable("Too much file history needs to be checked.");
    }
    const handle = await openVolume(initial.previous.volume, initial.previous.serial);
    try {
      const journal = await queryJournal(handle);
      assertCoverage(journal, initial.previous.journalId, first, last);
      const input = Buffer.alloc(48);
      input.writeUInt32LE(0xffff_ffff, 8);
      input.writeBigUInt64LE(journal.id, 32);
      input.writeUInt16LE(2, 40);
      input.writeUInt16LE(2, 42);
      let cursor = first;
      let reads = 0;
      let records = 0;
      while (cursor < last) {
        if (reads >= maximumJournalReads) {
          throw new IdentityUnavailable("Too much file history needs to be checked.");
        }
        reads += 1;
        input.writeBigInt64LE(cursor, 0);
        const output = await control(handle, 0x0009_03ab, input, journalBufferSize);
        if (output.length < 8) throw new IdentityUnavailable("File history is invalid.");
        const next = output.readBigInt64LE();
        if (next <= cursor) throw new IdentityUnavailable("File history is incomplete.");
        let offset = 8;
        while (offset < output.length) {
          records += 1;
          if (records > maximumJournalRecords) {
            throw new IdentityUnavailable("Too much file history needs to be checked.");
          }
          if (offset + 8 > output.length) throw new IdentityUnavailable("File history is invalid.");
          const length = output.readUInt32LE(offset);
          const version = output.readUInt16LE(offset + 4);
          if (version !== 2) {
            throw new IdentityUnavailable("This file history is unsupported.");
          }
          if (length < 60 || length % 8 !== 0 || offset + length > output.length) {
            throw new IdentityUnavailable("File history is invalid.");
          }
          const usn = output.readBigInt64LE(offset + 24);
          if (usn < cursor || usn >= next)
            throw new IdentityUnavailable("File history is invalid.");
          const reason = output.readUInt32LE(offset + 40);
          if ((reason & 0x200) !== 0) {
            const fileId = output.subarray(offset + 8, offset + 16).toString("hex");
            for (const candidate of candidates.get(fileId) ?? []) {
              if (usn >= candidate.previous.checkpoint && usn < candidate.current.checkpoint) {
                results[candidate.index] = "different";
              }
            }
          }
          offset += length;
        }
        cursor = next;
      }
      assertCoverage(await queryJournal(handle), initial.previous.journalId, first, last);
    } finally {
      await close(handle);
    }
  }

  async function verify(comparisons: readonly FileIdentityComparison[]) {
    const results: ("same" | "different")[] = comparisons.map(() => "same");
    const groups = new Map<string, Comparison[]>();
    for (const [index, comparison] of comparisons.entries()) {
      if (
        comparison.previous.source !== comparison.current.source ||
        comparison.previous.objectKey !== comparison.current.objectKey
      ) {
        results[index] = "different";
        continue;
      }
      const previous = readEvidence(comparison.previous);
      const current = readEvidence(comparison.current);
      if (previous.journalId !== current.journalId) {
        throw new IdentityUnavailable("File history is no longer available.");
      }
      if (current.checkpoint < previous.checkpoint) {
        throw new ObservationExpired("The file changed while it was being checked.");
      }
      const groupKey = `${previous.volume}:${previous.serial}:${previous.journalId}`;
      const group = groups.get(groupKey);
      const item = { index, previous, current };
      if (group === undefined) groups.set(groupKey, [item]);
      else group.push(item);
    }
    for (const group of groups.values()) await verifyGroup(group, results);
    return results;
  }

  return { read, verify } satisfies IdentityAdapter;
}
