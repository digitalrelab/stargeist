import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LibraryError } from "@stargeist/domain/libraries";
import { Layer, Effect, Exit, Scope } from "effect";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { TemporaryStorage, pathsLayer, temporaryStorageLayer } from "../storage";
import { makeLibraryListing } from "./listing";

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-workspace-listing-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  return {
    root,
    layer: temporaryStorageLayer.pipe(Layer.provide(pathsLayer(join(root, "profile")))),
  };
}

describe("active library listing", () => {
  it("releases failed acquisitions without leaving temporary files", async () => {
    const { root, layer } = await createFixture();

    await Effect.runPromise(
      Effect.gen(function* () {
        const paths = yield* TemporaryStorage;
        const listing = yield* makeLibraryListing;
        const error = yield* listing.open(join(root, "missing")).pipe(Effect.flip);

        expect(error).toBeInstanceOf(LibraryError);
        expect(error.code).toBe("FolderUnavailable");
        expect(yield* Effect.promise(() => readdir(paths.directory))).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });

  it("expires replaced views and ignores their stale close requests", async () => {
    const { root, layer } = await createFixture();

    await Effect.runPromise(
      Effect.gen(function* () {
        const paths = yield* TemporaryStorage;
        const scope = yield* Scope.fork(yield* Effect.scope);
        const listing = yield* makeLibraryListing.pipe(Scope.provide(scope));
        const first = yield* listing.open(root);
        const second = yield* listing.open(root);

        expect(second.listingId).not.toBe(first.listingId);
        expect(yield* Effect.promise(() => readdir(paths.directory))).toHaveLength(1);
        expect((yield* listing.read(first.listingId, 0).pipe(Effect.flip)).code).toBe(
          "ListingExpired",
        );

        yield* listing.close(first.listingId);
        expect(yield* listing.read(second.listingId, 0)).toEqual(second);

        yield* Scope.close(scope, Exit.void);
        expect(yield* Effect.promise(() => readdir(paths.directory))).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });

  it("expires explicitly closed views and removes their temporary files", async () => {
    const { root, layer } = await createFixture();

    await Effect.runPromise(
      Effect.gen(function* () {
        const paths = yield* TemporaryStorage;
        const listing = yield* makeLibraryListing;
        const page = yield* listing.open(root);

        yield* listing.close(page.listingId);

        expect((yield* listing.read(page.listingId, 0).pipe(Effect.flip)).code).toBe(
          "ListingExpired",
        );
        expect(yield* Effect.promise(() => readdir(paths.directory))).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });
});
