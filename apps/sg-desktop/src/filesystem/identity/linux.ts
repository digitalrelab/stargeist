import { constants } from "node:fs";
import { open, readFile } from "node:fs/promises";
import koffi from "koffi";
import { IdentityUnavailable } from "./errors";
import { syscall } from "./posix";
import type { IdentityAdapter, NativeFile } from "./types";

const openPath = 0x200000;
const atEmptyPath = 0x1000;
const ext4 = 0xef53n;
const getFilesystemUuid = 0x80111500;

export function createLinuxIdentity(): IdentityAdapter {
  const library = koffi.load("libc.so.6");
  const nameToHandle = library.func(
    "int name_to_handle_at(int fd, const char *path, void *handle, void *mount, int flags)",
  );
  const statfs = library.func("int fstatfs(int fd, void *buffer)");
  const ioctl = library.func("int ioctl(int fd, unsigned long request, void *buffer)");

  const handleFor = async (fd: number) => {
    const handle = Buffer.alloc(136);
    handle.writeUInt32LE(128);
    const mount = Buffer.alloc(4);
    await syscall(nameToHandle, fd, "", handle, mount, atEmptyPath);
    if (handle.readUInt32LE(0) !== 8 || handle.readInt32LE(4) !== 1) {
      throw new IdentityUnavailable("This filesystem does not provide a supported file handle.");
    }
    return { handle: handle.subarray(8, 16), mount: mount.readInt32LE() };
  };

  return {
    async read(path): Promise<NativeFile> {
      const file = await open(path, openPath | constants.O_NOFOLLOW);
      try {
        const filesystem = Buffer.alloc(256);
        await syscall(statfs, file.fd, filesystem);
        if (filesystem.readBigInt64LE() !== ext4) {
          throw new IdentityUnavailable(
            "This filesystem does not provide supported file identities.",
          );
        }
        const identity = await handleFor(file.fd);
        const info = await file.stat({ bigint: true });
        const mounts = await readFile("/proc/self/mountinfo", "utf8");
        const mount = mounts.split("\n").find((line) => line.startsWith(`${identity.mount} `));
        const mountPath = mount
          ?.split(" ")[4]
          ?.replace(/\\([0-7]{3})/g, (_, octal: string) =>
            String.fromCharCode(Number.parseInt(octal, 8)),
          );
        if (!mountPath) throw new IdentityUnavailable("The file's volume is no longer mounted.");
        const volume = await open(mountPath, constants.O_RDONLY | constants.O_DIRECTORY);
        try {
          if (
            (await volume.stat({ bigint: true })).dev !== info.dev ||
            (await handleFor(volume.fd)).mount !== identity.mount
          ) {
            throw new IdentityUnavailable("The file's volume changed during inspection.");
          }
          const uuid = Buffer.alloc(17);
          await syscall(ioctl, volume.fd, getFilesystemUuid, uuid);
          if (uuid[0] !== 16 || uuid.subarray(1).every((byte) => byte === 0)) {
            throw new IdentityUnavailable("This volume has no persistent identifier.");
          }
          let type: NativeFile["type"] = "other";
          if (info.isFile()) type = "file";
          else if (info.isDirectory()) type = "folder";
          else if (info.isSymbolicLink()) type = "link";
          return {
            objectKey: `linux-ext4:${uuid.subarray(1).toString("hex")}:${identity.handle.toString("hex")}`,
            type,
            evidence: null,
          };
        } finally {
          await volume.close();
        }
      } finally {
        await file.close();
      }
    },
  };
}
