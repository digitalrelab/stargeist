import { fileAt } from "./file.test-support";
import { directoryPageSize, ListingId, type DirectoryListingPage } from "@stargeist/domain";
import { Selection } from "@stargeist/std/selection";
import { Deferred, Effect, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { expect, it, onTestFinished } from "vite-plus/test";
import { createFileListing, createFileSelectionController, type FileInteraction } from "./index";

const initial: DirectoryListingPage = {
  listingId: Schema.decodeUnknownSync(ListingId)("selection"),
  files: Array.from({ length: directoryPageSize }, (_, index) => fileAt(index)),
  offset: 0,
  hasMore: true,
};

function registryForTest() {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  return registry;
}

it("selects listing occurrences independently when file IDs or display names repeat", () => {
  const registry = registryForTest();
  const first = fileAt(0, "same.txt");
  const alias = { ...fileAt(1, "alias.txt"), id: first.id };
  const duplicateName = fileAt(2, "same.txt");
  const listing = createFileListing(
    { ...initial, files: [first, alias, duplicateName], hasMore: false },
    () => Effect.die("Unexpected read"),
  );
  const selection = createFileSelectionController(listing);
  registry.mount(selection.command);
  registry.set(selection.command, { type: "toggle", value: { index: 0, item: first } });
  expect(registry.get(selection.isSelected(0))).toBe(true);
  expect(registry.get(selection.isSelected(1))).toBe(false);
  expect(registry.get(selection.isSelected(2))).toBe(false);
  registry.set(selection.command, { type: "toggle", value: { index: 1, item: alias } });
  expect(Selection.count(registry.get(selection.selection))).toBe(2);
});

it("crosses a cached page boundary without changing membership and distinguishes focus from activation", async () => {
  const registry = registryForTest();
  const requests: number[] = [];
  const listing = createFileListing(initial, (offset) =>
    Effect.sync(() => {
      requests.push(offset);
      return {
        listingId: initial.listingId,
        offset,
        files: [fileAt(directoryPageSize, "next"), fileAt(directoryPageSize + 1, "last")],
        hasMore: false,
      };
    }),
  );
  const received = Atom.make<FileInteraction | undefined>(undefined);
  const selection = createFileSelectionController(listing, received);
  registry.mount(selection.command);
  registry.mount(listing.pages(directoryPageSize));
  await Effect.runPromise(AtomRegistry.getResult(registry, listing.pages(directoryPageSize)));
  registry.set(selection.command, {
    type: "focus",
    value: { index: directoryPageSize - 1, item: fileAt(directoryPageSize - 1) },
  });
  registry.set(selection.command, { type: "move", by: 1 });
  await Effect.runPromise(AtomRegistry.getResult(registry, selection.request));
  expect(registry.get(selection.active)).toBe(directoryPageSize);
  expect(Selection.count(registry.get(selection.selection))).toBe(0);
  expect(registry.get(received)?.type).toBe("focus");
  registry.set(selection.command, { type: "activate" });
  expect(registry.get(received)).toMatchObject({
    type: "activate",
    focused: { item: { name: "next" } },
  });
  registry.set(selection.command, { type: "move", by: 1 });
  await Effect.runPromise(AtomRegistry.getResult(registry, selection.request));
  expect(registry.get(selection.active)).toBe(directoryPageSize + 1);
  expect(registry.get(received)).toMatchObject({
    type: "focus",
    focused: { item: { name: "last" } },
  });
  expect(requests).toEqual([directoryPageSize]);
});

it("cancels a cross-page range without committing a placeholder or late selection", async () => {
  const registry = registryForTest();
  const pending = Effect.runSync(Deferred.make<DirectoryListingPage>());
  const listing = createFileListing(initial, () => Deferred.await(pending));
  const selection = createFileSelectionController(listing);
  registry.mount(selection.command);
  registry.set(selection.command, {
    type: "toggle",
    value: { index: directoryPageSize - 1, item: fileAt(directoryPageSize - 1) },
  });
  registry.set(selection.command, { type: "move", by: 1, extend: true });
  expect(registry.get(selection.request).waiting).toBe(true);
  expect(Selection.count(registry.get(selection.selection))).toBe(1);
  registry.set(selection.command, { type: "clear" });
  await Effect.runPromise(
    Deferred.succeed(pending, {
      listingId: initial.listingId,
      offset: directoryPageSize,
      files: [fileAt(directoryPageSize, "late")],
      hasMore: false,
    }),
  );
  expect(Selection.count(registry.get(selection.selection))).toBe(0);
  expect(registry.get(selection.active)).toBe(directoryPageSize - 1);
});

it("selects all without fetching and applies membership to subsequently loaded pages", async () => {
  const registry = registryForTest();
  const requests: number[] = [];
  const listing = createFileListing(initial, (offset) =>
    Effect.sync(() => {
      requests.push(offset);
      return {
        listingId: initial.listingId,
        offset,
        files: [fileAt(directoryPageSize, "unloaded")],
        hasMore: false,
      };
    }),
  );
  const selection = createFileSelectionController(listing);
  registry.mount(selection.command);
  registry.set(selection.command, { type: "all" });
  expect(requests).toEqual([]);
  expect(registry.get(selection.selection).scope).toBe(initial.listingId);
  registry.mount(listing.pages(directoryPageSize));
  await Effect.runPromise(AtomRegistry.getResult(registry, listing.pages(directoryPageSize)));
  expect(registry.get(selection.isSelected(directoryPageSize))).toBe(true);
  registry.set(selection.command, {
    type: "toggle",
    value: { index: directoryPageSize, item: fileAt(directoryPageSize, "unloaded") },
  });
  expect(registry.get(selection.isSelected(directoryPageSize))).toBe(false);
  expect(Selection.count(registry.get(selection.selection), directoryPageSize + 1)).toBe(
    directoryPageSize,
  );
});

it("retries a failed range page once and reuses it to resolve focus and membership", async () => {
  const registry = registryForTest();
  const requests: number[] = [];
  const listing = createFileListing(initial, (offset) =>
    Effect.suspend(() => {
      requests.push(offset);
      if (requests.length === 1) {
        return Effect.fail(new Error("Unavailable"));
      }
      return Effect.succeed({
        listingId: initial.listingId,
        offset,
        files: [fileAt(directoryPageSize, "next")],
        hasMore: false,
      });
    }),
  );
  const selection = createFileSelectionController(listing);
  registry.mount(selection.command);
  registry.mount(listing.pages(directoryPageSize));
  registry.set(selection.command, {
    type: "focus",
    value: { index: directoryPageSize - 1, item: fileAt(directoryPageSize - 1) },
  });
  registry.set(selection.command, { type: "range", index: directoryPageSize });
  expect(registry.get(selection.request)._tag).toBe("Failure");
  registry.set(selection.command, { type: "retry" });
  await Effect.runPromise(
    AtomRegistry.getResult(registry, selection.request, { suspendOnWaiting: true }),
  );
  expect(requests).toEqual([directoryPageSize, directoryPageSize]);
  expect(Selection.count(registry.get(selection.selection))).toBe(2);
  expect(registry.get(selection.current)?.item.name).toBe("next");
});

it("selects a multi-page range without rereading intermediate pages", async () => {
  const registry = registryForTest();
  const requests: number[] = [];
  const listing = createFileListing(initial, (offset) =>
    Effect.sync(() => {
      requests.push(offset);
      return {
        listingId: initial.listingId,
        offset,
        files: Array.from({ length: directoryPageSize }, (_, i) => fileAt(offset + i)),
        hasMore: offset === directoryPageSize,
      };
    }),
  );
  const reads: number[] = [];
  const selection = createFileSelectionController({
    ...listing,
    read: (offset, options) => {
      reads.push(offset);
      return listing.read(offset, options);
    },
  });
  registry.mount(selection.command);
  registry.mount(listing.pages(directoryPageSize));
  await Effect.runPromise(AtomRegistry.getResult(registry, listing.pages(directoryPageSize)));
  registry.mount(listing.pages(directoryPageSize * 2));
  await Effect.runPromise(AtomRegistry.getResult(registry, listing.pages(directoryPageSize * 2)));
  registry.set(selection.command, {
    type: "focus",
    value: { index: directoryPageSize - 1, item: fileAt(directoryPageSize - 1) },
  });
  registry.set(selection.command, { type: "range", index: directoryPageSize * 2 + 1 });
  await Effect.runPromise(AtomRegistry.getResult(registry, selection.request));
  expect(Selection.count(registry.get(selection.selection))).toBe(directoryPageSize + 3);
  expect(registry.get(selection.isSelected(254))).toBe(false);
  expect(registry.get(selection.isSelected(255))).toBe(true);
  expect(registry.get(selection.isSelected(513))).toBe(true);
  registry.set(selection.command, { type: "move", by: -2, extend: true });
  await Effect.runPromise(AtomRegistry.getResult(registry, selection.request));
  expect(Selection.count(registry.get(selection.selection))).toBe(directoryPageSize + 1);
  expect(registry.get(selection.isSelected(513))).toBe(false);
  expect(requests).toEqual([directoryPageSize, directoryPageSize * 2]);
  expect(reads).toEqual([directoryPageSize * 2, directoryPageSize]);
});

it("finishes a range across an unloaded page without activating the newly focused file", async () => {
  const registry = registryForTest();
  const pending = Effect.runSync(Deferred.make<DirectoryListingPage>());
  const listing = createFileListing(initial, () => Deferred.await(pending));
  const received = Atom.make<FileInteraction | undefined>(undefined);
  const selection = createFileSelectionController(listing, received);
  registry.mount(selection.command);
  registry.set(selection.command, {
    type: "focus",
    value: { index: directoryPageSize - 1, item: fileAt(directoryPageSize - 1) },
  });
  registry.set(selection.command, { type: "move", by: 1, extend: true });
  expect(registry.get(selection.request).waiting).toBe(true);
  expect(Selection.count(registry.get(selection.selection))).toBe(0);
  await Effect.runPromise(
    Deferred.succeed(pending, {
      listingId: initial.listingId,
      offset: directoryPageSize,
      files: [fileAt(directoryPageSize, "arrived")],
      hasMore: false,
    }),
  );
  await Effect.runPromise(
    AtomRegistry.getResult(registry, selection.request, { suspendOnWaiting: true }),
  );
  expect(Selection.count(registry.get(selection.selection))).toBe(2);
  expect(registry.get(selection.isSelected(255))).toBe(true);
  expect(registry.get(selection.isSelected(directoryPageSize))).toBe(true);
  expect(registry.get(selection.active)).toBe(directoryPageSize);
  expect(registry.get(received)?.type).toBe("select");
});
