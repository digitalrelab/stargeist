import { open } from "node:fs/promises";
import koffi from "koffi";
import { IdentityUnavailable } from "./errors";
import { syscall } from "./posix";
import type { IdentityAdapter, NativeFile } from "./types";

const returnedAttributes = 0x80000000;
const objectAttributes = 0x02000008;
const volumeAttributes = 0x00060000;
const pathFromId = 0x00004000;
const eventOnly = 0x8000;
const openSymlink = 0x200000;
const packInvalidAttributes = 8;

function attributes(common: number, volume: number) {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt16LE(5);
  buffer.writeUInt32LE((returnedAttributes | common) >>> 0, 4);
  if (volume) buffer.writeUInt32LE((0x80000000 | volume) >>> 0, 8);
  return buffer;
}

export function createDarwinIdentity(): IdentityAdapter {
  const library = koffi.load("/usr/lib/libSystem.B.dylib");
  const getattr = library.func(
    "int fgetattrlist(int fd, const void *attrs, void *output, size_t size, unsigned long options)",
  );
  const objectRequest = attributes(objectAttributes, 0);
  const volumeRequest = attributes(0, volumeAttributes);

  return {
    async read(path): Promise<NativeFile> {
      const file = await open(path, eventOnly | openSymlink);
      try {
        const volume = Buffer.alloc(72);
        await syscall(
          getattr,
          file.fd,
          volumeRequest,
          volume,
          volume.length,
          packInvalidAttributes,
        );
        if (
          volume.readUInt32LE(0) !== volume.length ||
          (volume.readUInt32LE(8) & volumeAttributes) !== volumeAttributes ||
          (volume.readUInt32LE(24) & volume.readUInt32LE(40) & pathFromId) === 0
        ) {
          throw new IdentityUnavailable("This volume does not provide persistent file identities.");
        }
        const uuid = volume.subarray(56, 72);
        if (uuid.every((byte) => byte === 0)) {
          throw new IdentityUnavailable("This volume has no persistent identifier.");
        }

        const object = Buffer.alloc(36);
        await syscall(
          getattr,
          file.fd,
          objectRequest,
          object,
          object.length,
          packInvalidAttributes,
        );
        if (
          object.readUInt32LE(0) !== object.length ||
          (object.readUInt32LE(4) & objectAttributes) !== objectAttributes
        ) {
          throw new IdentityUnavailable("This file does not provide a persistent identity.");
        }
        const id = object.readBigUInt64LE(28);
        if (id === 0n) throw new IdentityUnavailable("This file has no persistent identifier.");
        let type: NativeFile["type"] = "other";
        switch (object.readUInt32LE(24)) {
          case 1:
            type = "file";
            break;
          case 2:
            type = "folder";
            break;
          case 5:
            type = "link";
            break;
        }
        return { objectKey: `darwin:${uuid.toString("hex")}:${id}`, type, evidence: null };
      } finally {
        await file.close();
      }
    },
  };
}
