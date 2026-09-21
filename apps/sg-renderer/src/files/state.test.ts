import { entryPageSize, ListingId, type DirectoryListingPage } from "@stargeist/domain";
import { Effect, Schema } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { createFileListing } from "./index";

const first: DirectoryListingPage = {
  listingId: Schema.decodeUnknownSync(ListingId)("files"),
  offset: 0,
  entries: Array.from({ length: entryPageSize }, (_, index) => ({
    name: `file-${index}`,
    kind: "file" as const,
  })),
  hasMore: true,
};

const last: DirectoryListingPage = {
  listingId: first.listingId,
  offset: entryPageSize,
  entries: [{ name: "last", kind: "directory" }],
  hasMore: false,
};

function createRegistry() {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  return registry;
}

describe("File listing", () => {
  it("adapts directory entries and forwards page offsets to its source", async () => {
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
          items: first.entries,
          next: entryPageSize,
        });
        expect(requests).toEqual([]);
        expect(registry.get(listing.extent)).toEqual({ count: entryPageSize, hasMore: true });

        expect(yield* AtomRegistry.getResult(registry, listing.pages(entryPageSize))).toEqual({
          items: last.entries,
          next: null,
        });
        expect(requests).toEqual([entryPageSize]);
        expect(registry.get(listing.extent)).toEqual({ count: entryPageSize + 1, hasMore: false });

        expect(yield* AtomRegistry.getResult(registry, listing.pages(0))).toEqual({
          items: first.entries,
          next: entryPageSize,
        });
        expect(registry.get(listing.extent)).toEqual({ count: entryPageSize + 1, hasMore: false });
      }).pipe(Effect.timeout("3 seconds")),
    );
  });
});
