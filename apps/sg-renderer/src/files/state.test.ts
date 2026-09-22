import { fileAt } from "./file.test-support";
import { directoryPageSize, DirectorySessionId, type DirectoryPage } from "@stargeist/domain";
import { Effect, Schema } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { createDirectoryContents } from "./index";

const first: DirectoryPage = {
  directorySessionId: Schema.decodeUnknownSync(DirectorySessionId)("files"),
  offset: 0,
  files: Array.from({ length: directoryPageSize }, (_, index) => fileAt(index)),
  hasMore: true,
};

const last: DirectoryPage = {
  directorySessionId: first.directorySessionId,
  offset: directoryPageSize,
  files: [{ ...fileAt(directoryPageSize, "last"), kind: "folder" }],
  hasMore: false,
};

function createRegistry() {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  return registry;
}

describe("Directory contents", () => {
  it("adapts directory files and forwards page offsets to its source", async () => {
    const registry = createRegistry();
    const requests: number[] = [];
    const contents = createDirectoryContents(first, (offset) =>
      Effect.sync(() => {
        requests.push(offset);
        return last;
      }),
    );
    registry.mount(contents.extent);

    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, contents.pages(0))).toEqual({
          items: first.files,
          next: directoryPageSize,
        });
        expect(requests).toEqual([]);
        expect(registry.get(contents.extent)).toEqual({ count: directoryPageSize, hasMore: true });

        expect(yield* AtomRegistry.getResult(registry, contents.pages(directoryPageSize))).toEqual({
          items: last.files,
          next: null,
        });
        expect(requests).toEqual([directoryPageSize]);
        expect(registry.get(contents.extent)).toEqual({
          count: directoryPageSize + 1,
          hasMore: false,
        });

        expect(yield* AtomRegistry.getResult(registry, contents.pages(0))).toEqual({
          items: first.files,
          next: directoryPageSize,
        });
        expect(registry.get(contents.extent)).toEqual({
          count: directoryPageSize + 1,
          hasMore: false,
        });
      }).pipe(Effect.timeout("3 seconds")),
    );
  });
});
