import { fileAt } from "./file.test-support";
import { directoryPageSize, ListingId, type DirectoryListingPage } from "@stargeist/domain";
import { Effect, Schema } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { createFileListing } from "./index";

const first: DirectoryListingPage = {
  listingId: Schema.decodeUnknownSync(ListingId)("files"),
  offset: 0,
  files: Array.from({ length: directoryPageSize }, (_, index) => fileAt(index)),
  hasMore: true,
};

const last: DirectoryListingPage = {
  listingId: first.listingId,
  offset: directoryPageSize,
  files: [{ ...fileAt(directoryPageSize, "last"), type: "folder" }],
  hasMore: false,
};

function createRegistry() {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  return registry;
}

describe("File listing", () => {
  it("adapts directory files and forwards page offsets to its source", async () => {
    const registry = createRegistry();
    const requests: number[] = [];
    const listing = createFileListing(first, (offset) =>
      Effect.sync(() => {
        requests.push(offset);
        return last;
      }),
    );
    registry.mount(listing.extent);

    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, listing.pages(0))).toEqual({
          items: first.files,
          next: directoryPageSize,
        });
        expect(requests).toEqual([]);
        expect(registry.get(listing.extent)).toEqual({ count: directoryPageSize, hasMore: true });

        expect(yield* AtomRegistry.getResult(registry, listing.pages(directoryPageSize))).toEqual({
          items: last.files,
          next: null,
        });
        expect(requests).toEqual([directoryPageSize]);
        expect(registry.get(listing.extent)).toEqual({
          count: directoryPageSize + 1,
          hasMore: false,
        });

        expect(yield* AtomRegistry.getResult(registry, listing.pages(0))).toEqual({
          items: first.files,
          next: directoryPageSize,
        });
        expect(registry.get(listing.extent)).toEqual({
          count: directoryPageSize + 1,
          hasMore: false,
        });
      }).pipe(Effect.timeout("3 seconds")),
    );
  });
});
