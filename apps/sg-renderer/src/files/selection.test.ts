import { fileAt } from "./file.test-support";
import { entryPageSize, ListingId, type DirectoryListingPage } from "@stargeist/domain";
import { Selection } from "@stargeist/std/selection";
import { Deferred, Effect, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { expect, it, onTestFinished } from "vite-plus/test";
import { createFileListing, createFileSelectionController, type FileInteraction } from "./index";

const initial: DirectoryListingPage = {
  listingId: Schema.decodeUnknownSync(ListingId)("selection"),
  entries: Array.from({ length: entryPageSize }, (_, index) => fileAt(index)),
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
    { ...initial, entries: [first, alias, duplicateName], hasMore: false },
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
        entries: [fileAt(entryPageSize, "next"), fileAt(entryPageSize + 1, "last")],
        hasMore: false,
      };
    }),
  );
  const received = Atom.make<FileInteraction | undefined>(undefined);
  const selection = createFileSelectionController(listing, received);
  registry.mount(selection.command);
  registry.mount(listing.pages(entryPageSize));
  await Effect.runPromise(AtomRegistry.getResult(registry, listing.pages(entryPageSize)));
  registry.set(selection.command, {
    type: "focus",
    value: { index: entryPageSize - 1, item: fileAt(entryPageSize - 1) },
  });
  registry.set(selection.command, { type: "move", by: 1 });
  await Effect.runPromise(AtomRegistry.getResult(registry, selection.request));
  expect(registry.get(selection.active)).toBe(entryPageSize);
  expect(Selection.count(registry.get(selection.selection))).toBe(0);
  expect(registry.get(received)?.type).toBe("focus");
  registry.set(selection.command, { type: "activate" });
  expect(registry.get(received)).toMatchObject({
    type: "activate",
    focused: { item: { name: "next" } },
  });
  registry.set(selection.command, { type: "move", by: 1 });
  await Effect.runPromise(AtomRegistry.getResult(registry, selection.request));
  expect(registry.get(selection.active)).toBe(entryPageSize + 1);
  expect(registry.get(received)).toMatchObject({
    type: "focus",
    focused: { item: { name: "last" } },
  });
  expect(requests).toEqual([entryPageSize]);
});

it("cancels a cross-page range without committing a placeholder or late selection", async () => {
  const registry = registryForTest();
  const pending = Effect.runSync(Deferred.make<DirectoryListingPage>());
  const listing = createFileListing(initial, () => Deferred.await(pending));
  const selection = createFileSelectionController(listing);
  registry.mount(selection.command);
  registry.set(selection.command, {
    type: "toggle",
    value: { index: entryPageSize - 1, item: fileAt(entryPageSize - 1) },
  });
  registry.set(selection.command, { type: "move", by: 1, extend: true });
  expect(registry.get(selection.request).waiting).toBe(true);
  expect(Selection.count(registry.get(selection.selection))).toBe(1);
  registry.set(selection.command, { type: "clear" });
  await Effect.runPromise(
    Deferred.succeed(pending, {
      listingId: initial.listingId,
      offset: entryPageSize,
      entries: [fileAt(entryPageSize, "late")],
      hasMore: false,
    }),
  );
  expect(Selection.count(registry.get(selection.selection))).toBe(0);
  expect(registry.get(selection.active)).toBe(entryPageSize - 1);
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
        entries: [fileAt(entryPageSize, "unloaded")],
        hasMore: false,
      };
    }),
  );
  const selection = createFileSelectionController(listing);
  registry.mount(selection.command);
  registry.set(selection.command, { type: "all" });
  expect(requests).toEqual([]);
  expect(registry.get(selection.selection).scope).toBe(initial.listingId);
  registry.mount(listing.pages(entryPageSize));
  await Effect.runPromise(AtomRegistry.getResult(registry, listing.pages(entryPageSize)));
  expect(registry.get(selection.isSelected(entryPageSize))).toBe(true);
  registry.set(selection.command, {
    type: "toggle",
    value: { index: entryPageSize, item: fileAt(entryPageSize, "unloaded") },
  });
  expect(registry.get(selection.isSelected(entryPageSize))).toBe(false);
  expect(Selection.count(registry.get(selection.selection), entryPageSize + 1)).toBe(entryPageSize);
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
        entries: [fileAt(entryPageSize, "next")],
        hasMore: false,
      });
    }),
  );
  const selection = createFileSelectionController(listing);
  registry.mount(selection.command);
  registry.mount(listing.pages(entryPageSize));
  registry.set(selection.command, {
    type: "focus",
    value: { index: entryPageSize - 1, item: fileAt(entryPageSize - 1) },
  });
  registry.set(selection.command, { type: "range", index: entryPageSize });
  expect(registry.get(selection.request)._tag).toBe("Failure");
  registry.set(selection.command, { type: "retry" });
  await Effect.runPromise(
    AtomRegistry.getResult(registry, selection.request, { suspendOnWaiting: true }),
  );
  expect(requests).toEqual([entryPageSize, entryPageSize]);
  expect(Selection.count(registry.get(selection.selection))).toBe(2);
  expect(registry.get(selection.current)?.item.name).toBe("next");
});

it("resolves a multi-page range by page and preserves its anchor when shrinking", async () => {
  const registry = registryForTest();
  const requests: number[] = [];
  const listing = createFileListing(initial, (offset) =>
    Effect.sync(() => {
      requests.push(offset);
      return {
        listingId: initial.listingId,
        offset,
        entries: Array.from({ length: entryPageSize }, (_, i) => fileAt(offset + i)),
        hasMore: offset === entryPageSize,
      };
    }),
  );
  const selection = createFileSelectionController(listing);
  registry.mount(selection.command);
  registry.mount(listing.pages(entryPageSize));
  await Effect.runPromise(AtomRegistry.getResult(registry, listing.pages(entryPageSize)));
  registry.mount(listing.pages(entryPageSize * 2));
  await Effect.runPromise(AtomRegistry.getResult(registry, listing.pages(entryPageSize * 2)));
  registry.set(selection.command, {
    type: "focus",
    value: { index: entryPageSize - 1, item: fileAt(entryPageSize - 1) },
  });
  registry.set(selection.command, { type: "range", index: entryPageSize * 2 + 1 });
  await Effect.runPromise(AtomRegistry.getResult(registry, selection.request));
  expect(Selection.count(registry.get(selection.selection))).toBe(entryPageSize + 3);
  expect(registry.get(selection.isSelected(254))).toBe(false);
  expect(registry.get(selection.isSelected(255))).toBe(true);
  expect(registry.get(selection.isSelected(513))).toBe(true);
  registry.set(selection.command, { type: "move", by: -2, extend: true });
  await Effect.runPromise(AtomRegistry.getResult(registry, selection.request));
  expect(Selection.count(registry.get(selection.selection))).toBe(entryPageSize + 1);
  expect(registry.get(selection.isSelected(513))).toBe(false);
  expect(requests).toEqual([entryPageSize, entryPageSize * 2]);
});

it("finishes a range across an unloaded page without activating the newly focused entry", async () => {
  const registry = registryForTest();
  const pending = Effect.runSync(Deferred.make<DirectoryListingPage>());
  const listing = createFileListing(initial, () => Deferred.await(pending));
  const received = Atom.make<FileInteraction | undefined>(undefined);
  const selection = createFileSelectionController(listing, received);
  registry.mount(selection.command);
  registry.set(selection.command, {
    type: "focus",
    value: { index: entryPageSize - 1, item: fileAt(entryPageSize - 1) },
  });
  registry.set(selection.command, { type: "move", by: 1, extend: true });
  expect(registry.get(selection.request).waiting).toBe(true);
  expect(Selection.count(registry.get(selection.selection))).toBe(0);
  await Effect.runPromise(
    Deferred.succeed(pending, {
      listingId: initial.listingId,
      offset: entryPageSize,
      entries: [fileAt(entryPageSize, "arrived")],
      hasMore: false,
    }),
  );
  await Effect.runPromise(
    AtomRegistry.getResult(registry, selection.request, { suspendOnWaiting: true }),
  );
  expect(Selection.count(registry.get(selection.selection))).toBe(2);
  expect(registry.get(selection.isSelected(255))).toBe(true);
  expect(registry.get(selection.isSelected(entryPageSize))).toBe(true);
  expect(registry.get(selection.active)).toBe(entryPageSize);
  expect(registry.get(received)?.type).toBe("select");
});
