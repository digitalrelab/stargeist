import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { databaseLayer } from "@stargeist/database";
import { filesLayer } from "@stargeist/database/files";
import { entryPageSize } from "@stargeist/domain";
import { Layer, Effect, Exit, Scope } from "effect";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { TemporaryStorage, pathsLayer, temporaryStorageLayer } from "../storage";
import { openListing } from "./index";

async function createFixture(names: string[] = []) {
  const root = await mkdtemp(join(tmpdir(), "stargeist-directory-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const content = join(root, "content");
  await mkdir(content);
  await Promise.all(names.map((name) => writeFile(join(content, name), "")));

  const filename = join(root, "application.sqlite");

  return {
    content,
    open: () => openListing(content),
    layer: Layer.merge(
      filesLayer.pipe(Layer.provide(databaseLayer(filename))),
      temporaryStorageLayer.pipe(Layer.provide(pathsLayer(join(root, "profile")))),
    ),
  };
}

describe("directory listings", () => {
  it("rejects negative, unaligned, and unread page positions", async () => {
    const { layer, open } = await createFixture(["file.txt"]);

    await Effect.runPromise(
      Effect.gen(function* () {
        const listing = yield* open();

        for (const offset of [-entryPageSize, 1, entryPageSize]) {
          expect((yield* listing.read(offset).pipe(Effect.flip)).code).toBe("ListingExpired");
        }
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });

  it("pages only immediate entries and preserves earlier pages", async () => {
    const names = Array.from({ length: entryPageSize + 4 }, (_, index) => `file-${index}.txt`);
    const { content, layer, open } = await createFixture(names);
    await mkdir(join(content, "nested"));
    await writeFile(join(content, "nested", "not-visible.txt"), "");

    await Effect.runPromise(
      Effect.gen(function* () {
        const listing = yield* open();
        const first = listing.firstPage;
        const second = yield* listing.read(entryPageSize);

        expect(first.entries).toHaveLength(entryPageSize);
        expect(first.hasMore).toBe(true);
        expect(second.entries).toHaveLength(5);
        expect(second.hasMore).toBe(false);
        expect([...first.entries, ...second.entries].map((entry) => entry.name).sort()).toEqual(
          [...names, "nested"].sort(),
        );
        expect(
          [...first.entries, ...second.entries].find((entry) => entry.name === "nested")?.type,
        ).toBe("folder");
        expect(yield* listing.read(0)).toEqual(first);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });

  it("keeps concurrent listings independent and releases each with its own scope", async () => {
    const { layer, open } = await createFixture(["file.txt"]);

    await Effect.runPromise(
      Effect.gen(function* () {
        const paths = yield* TemporaryStorage;
        const firstScope = yield* Scope.fork(yield* Effect.scope);
        const secondScope = yield* Scope.fork(yield* Effect.scope);
        const first = yield* open().pipe(Scope.provide(firstScope));
        const second = yield* open().pipe(Scope.provide(secondScope));

        expect(first.listingId).not.toBe(second.listingId);
        expect(yield* Effect.promise(() => readdir(paths.directory))).toHaveLength(2);

        yield* Scope.close(firstScope, Exit.void);

        expect(yield* Effect.promise(() => readdir(paths.directory))).toHaveLength(1);
        expect((yield* second.read(0)).entries).toMatchObject([
          {
            name: "file.txt",
            type: "file",
            mediaType: "text/plain",
            id: expect.stringMatching(/^fil_/),
          },
        ]);

        yield* Scope.close(secondScope, Exit.void);
        expect(yield* Effect.promise(() => readdir(paths.directory))).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });
});

it("expires a listing when its root is moved and replaced instead of mixing directory objects", async () => {
  const names = Array.from({ length: entryPageSize + 4 }, (_, index) => `file-${index}.txt`);
  const { content, layer, open } = await createFixture(names);
  await Effect.runPromise(
    Effect.gen(function* () {
      const listing = yield* open();
      yield* Effect.promise(async () => {
        await rename(content, `${content}-moved`);
        await mkdir(content);
        await Promise.all(names.map((name) => writeFile(join(content, name), "replacement")));
      });
      expect(yield* listing.read(entryPageSize).pipe(Effect.flip)).toMatchObject({
        code: "ListingExpired",
      });
      expect(yield* listing.read(0)).toEqual(listing.firstPage);
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );
});
