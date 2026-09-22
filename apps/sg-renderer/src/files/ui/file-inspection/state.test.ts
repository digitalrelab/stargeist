import { fileAt } from "../../file.test-support";
import { ListingId, directoryPageSize } from "@stargeist/domain";
import { Selection, type SelectionState } from "@stargeist/std/selection";
import { Deferred, Effect, HashSet, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { expect, it, onTestFinished, vi } from "vite-plus/test";
import { createFileSelectionController } from "../../selection";
import { createFileListing } from "../../state";
import { createFileInspection, describeFileInspection, type FileInspectionInput } from "./state";

const listingId = Schema.decodeUnknownSync(ListingId)("inspection");
const empty = Selection.empty<number, typeof listingId>(listingId);

function input(
  type: "focus" | "select" | "activate",
  index: number | undefined,
  selection: SelectionState<number, typeof listingId> = empty,
): FileInspectionInput {
  let focused;
  if (index !== undefined) {
    focused = { index, item: fileAt(index) };
  }
  return {
    read: (position) => Effect.succeed(fileAt(position)),
    folder: "/files",
    extent: Atom.make({ count: 10_000, hasMore: false }),
    interaction: { type, focused, selection },
  };
}

function setup() {
  vi.useFakeTimers();
  const registry = AtomRegistry.make();
  const inspection = createFileInspection();
  const unmount = registry.mount(inspection.command);
  const updates: Array<string | undefined> = [];
  registry.get(inspection.target);
  registry.subscribe(inspection.target, (value) => {
    if (!value) {
      return updates.push(undefined);
    }
    const description = describeFileInspection(value);
    if (description.type === "file") {
      updates.push(description.name);
    } else {
      updates.push(description.label);
    }
  });
  onTestFinished(() => {
    registry.dispose();
    vi.useRealTimers();
  });
  return {
    registry,
    inspection,
    unmount,
    updates,
    send: (command: Parameters<typeof inspection.command.write>[1]) =>
      registry.set(inspection.command, command),
    interact: (value: FileInspectionInput) =>
      registry.set(inspection.command, { type: "interact", input: value }),
    target: () => registry.get(inspection.target),
  };
}

it("shows inspection from arrow navigation without changing checkbox selection", async () => {
  const { registry, inspection, target } = setup();
  const listing = createFileListing(
    {
      listingId,
      files: [0, 1, 2].map((index) => fileAt(index)),
      offset: 0,
      hasMore: false,
    },
    () => Effect.die("Navigation must use the cached page"),
  );
  const selection = createFileSelectionController(listing, inspection.bind(listing, "/files"));
  registry.mount(selection.command);
  const navigate = (by: number) => {
    registry.set(selection.command, { type: "move", by });
  };
  expect(target()).toBeUndefined();
  navigate(1);
  expect(target()).toBeUndefined();
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.file?.name).toBe("file-0");
  registry.set(selection.command, { type: "replace", keys: [2] });
  const membership = registry.get(selection.selection);
  navigate(1);
  expect(registry.get(selection.active)).toBe(1);
  expect(target()?.file?.name).toBe("file-2");
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.file?.name).toBe("file-1");
  expect(registry.get(selection.selection)).toBe(membership);
  expect(Selection.count(membership)).toBe(1);
  navigate(-1);
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.file?.name).toBe("file-0");
  registry.set(selection.command, { type: "all" });
  expect(describeFileInspection(target()!)).toEqual({
    type: "selection",
    label: "3 files selected",
  });
  navigate(-1);
  expect(registry.get(selection.active)).toBe(0);
  await vi.advanceTimersByTimeAsync(200);
  navigate(-1);
  await vi.advanceTimersByTimeAsync(249);
  expect(describeFileInspection(target()!).type).toBe("selection");
  await vi.advanceTimersByTimeAsync(1);
  expect(target()?.file?.name).toBe("file-0");
  expect(registry.get(selection.selection).mode).toBe("all");
  navigate(1);
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.file?.name).toBe("file-1");
});

it("inspects the navigated file inside or outside a group without changing its selection", async () => {
  const { interact, target, updates } = setup();
  const members = Selection.replace(listingId, [0, 1]);
  interact(input("select", 1, members));
  const group = target();
  expect(group?.selection.members).toBe(members);
  expect(updates).toEqual(["2 files selected"]);
  interact(input("focus", 0, members));
  await vi.advanceTimersByTimeAsync(249);
  expect(target()).toBe(group);
  await vi.advanceTimersByTimeAsync(1);
  expect(target()?.file?.name).toBe("file-0");
  interact(input("focus", 2, members));
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.file?.name).toBe("file-2");
  expect(Selection.count(target()!.selection.members)).toBe(1);
  expect(Selection.count(members)).toBe(2);
  interact(input("select", 1, members));
  expect(target()?.selection.members).toBe(members);
  expect(updates).toEqual(["2 files selected", "file-0", "file-2", "2 files selected"]);
});

it("keeps select-all and exceptions compact, including an unknown total", async () => {
  const { interact, target, updates } = setup();
  const members = Selection.set(Selection.all<number, typeof listingId>(listingId), 5, false);
  interact(input("select", 5, members));
  expect(target()?.selection.members).toBe(members);
  expect(members.mode).toBe("all");
  if (members.mode !== "all") {
    throw new Error("Expected compact select-all");
  }
  expect(HashSet.size(members.excludedKeys)).toBe(1);
  expect(updates).toEqual(["9,999 files selected"]);
  interact({
    ...input("select", undefined, members),
    extent: Atom.make({ count: 256, hasMore: true }),
  });
  expect(updates).toEqual(["9,999 files selected", "All files selected except 1"]);
  interact(input("focus", 5, members));
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.file?.name).toBe("file-5");
});

it("waits until 250ms after navigation stops, including a burst of 5,000 intents", async () => {
  const { interact, target, updates } = setup();
  interact(input("activate", 9_999));
  for (let index = 0; index < 5_000; index++) {
    interact(input("focus", index));
  }
  expect(updates).toEqual(["file-9999"]);
  for (let index = 5_000; index < 5_010; index++) {
    await vi.advanceTimersByTimeAsync(200);
    interact(input("focus", index));
    expect(updates).toEqual(["file-9999"]);
  }
  await vi.advanceTimersByTimeAsync(249);
  expect(target()?.file?.name).toBe("file-9999");
  await vi.advanceTimersByTimeAsync(1);
  expect(updates).toEqual(["file-9999", "file-5009"]);
});

it("selection supersedes pending navigation, and activation explicitly inspects one group member", async () => {
  const { interact, target, updates } = setup();
  interact(input("activate", 0));
  interact(input("focus", 1));
  const members = Selection.replace(listingId, [2, 3]);
  interact(input("select", 3, members));
  expect(target()?.selection.members).toBe(members);
  await vi.advanceTimersByTimeAsync(300);
  expect(updates).toEqual(["file-0", "2 files selected"]);
  interact(input("activate", 2, members));
  expect(target()?.file?.name).toBe("file-2");
  expect(Selection.count(target()!.selection.members)).toBe(1);
  expect(Selection.count(members)).toBe(2);
});

it("describes the remaining selected file and clears inspection when selection becomes empty", () => {
  const { interact, target, updates } = setup();
  interact(input("select", 1, Selection.replace(listingId, [0])));
  expect(describeFileInspection(target()!)).toEqual({
    type: "file",
    name: "file-0",
  });
  interact(input("select", 1));
  expect(target()).toBeUndefined();
  interact(input("select", undefined));
  expect(target()).toBeUndefined();
  expect(updates).toEqual(["file-0", undefined]);
});

it("resolves the remaining select-all occurrence when the focused row is excluded", () => {
  const { registry, inspection, interact, target } = setup();
  let members = Selection.all<number, typeof listingId>(listingId);
  for (const index of [0, 1, 3]) {
    members = Selection.set(members, index, false);
  }
  const reads: number[] = [];
  interact({
    ...input("select", 3, members),
    extent: Atom.make({ count: 4, hasMore: false }),
    read: (position) => {
      reads.push(position);
      return Effect.succeed(fileAt(position));
    },
  });
  expect(target()?.selection.members).toBe(members);
  expect(target()?.index).toBe(2);
  expect(describeFileInspection(target()!)).toEqual({
    type: "file",
    name: "file-2",
  });
  expect(registry.get(inspection.inspectedIndex(listingId))).toBe(2);
  expect(reads).toEqual([2]);
});

it("resolves the remaining select-all occurrence when the final page arrives", async () => {
  const { registry, inspection, target } = setup();
  const requests: number[] = [];
  const listing = createFileListing(
    {
      listingId,
      files: Array.from({ length: directoryPageSize }, (_, index) => fileAt(index)),
      offset: 0,
      hasMore: true,
    },
    (offset) =>
      Effect.sync(() => {
        requests.push(offset);
        return {
          listingId,
          files: [fileAt(directoryPageSize, "remaining.txt")],
          offset,
          hasMore: false,
        };
      }),
  );
  registry.mount(listing.extent);
  let members = Selection.all<number, typeof listingId>(listingId);
  for (let index = 0; index < directoryPageSize; index++) {
    members = Selection.set(members, index, false);
  }
  registry.set(
    inspection.bind(listing, "/files"),
    input("select", directoryPageSize - 1, members).interaction,
  );
  expect(target()?.index).toBeUndefined();
  expect(requests).toEqual([]);
  registry.mount(listing.pages(directoryPageSize));
  await Effect.runPromise(AtomRegistry.getResult(registry, listing.pages(directoryPageSize)));
  expect(target()?.selection.members).toBe(members);
  expect(target()?.total).toBe(directoryPageSize + 1);
  expect(target()?.index).toBe(directoryPageSize);
  expect(target()?.file?.name).toBe("remaining.txt");
  expect(registry.get(inspection.inspectedIndex(listingId))).toBe(directoryPageSize);
  expect(requests).toEqual([directoryPageSize]);
});

it("loads a selected occurrence without interpreting its key as a name and discards an obsolete result", async () => {
  const { registry, inspection, interact, target } = setup();
  const pending = Effect.runSync(Deferred.make<ReturnType<typeof fileAt>>());
  const reads: number[] = [];
  interact({
    ...input("select", 1, Selection.replace(listingId, [0])),
    read: (position) => {
      reads.push(position);
      return Deferred.await(pending);
    },
  });
  expect(target()?.index).toBe(0);
  expect(target()?.file).toBeUndefined();
  expect(registry.get(inspection.detail).waiting).toBe(true);
  expect(reads).toEqual([0]);
  interact(input("activate", 2));
  await Effect.runPromise(Deferred.succeed(pending, fileAt(0, "obsolete.txt")));
  expect(target()?.file?.id).toBe(fileAt(2).id);
  expect(target()?.file?.name).toBe("file-2");
});

it("exposes detail read failures and retries the selected occurrence", async () => {
  const { registry, inspection, target } = setup();
  let available = false;
  const listing = createFileListing(
    {
      listingId,
      files: Array.from({ length: directoryPageSize }, (_, index) => fileAt(index)),
      offset: 0,
      hasMore: true,
    },
    () =>
      Effect.suspend(() => {
        if (!available) return Effect.fail(new Error("Unavailable"));
        return Effect.succeed({
          listingId,
          files: [fileAt(directoryPageSize, "remaining.txt")],
          offset: directoryPageSize,
          hasMore: false,
        });
      }),
  );
  registry.mount(listing.pages(directoryPageSize));
  registry.set(
    inspection.bind(listing, "/files"),
    input("select", 0, Selection.replace(listingId, [directoryPageSize])).interaction,
  );
  expect(registry.get(inspection.detail)._tag).toBe("Failure");
  expect(target()?.file).toBeUndefined();
  available = true;
  registry.refresh(inspection.detail);
  await Effect.runPromise(
    AtomRegistry.getResult(registry, inspection.detail, { suspendOnWaiting: true }),
  );
  expect(target()?.file?.name).toBe("remaining.txt");
});

it("publishes selection and inspection together and cancels queued navigation when selection clears", async () => {
  const { registry, inspection, target, updates } = setup();
  const files = Array.from({ length: 10 }, (_, index) => fileAt(index));
  const listing = createFileListing({ listingId, files, offset: 0, hasMore: false }, () =>
    Effect.die("Selection must use the cached page"),
  );
  const selection = createFileSelectionController(listing, inspection.bind(listing, "/files"));
  registry.mount(selection.command);
  const indicators: Array<number | undefined> = [];

  registry.subscribe(inspection.inspectedIndex(listingId), (name) => indicators.push(name), {
    immediate: true,
  });

  registry.set(selection.command, { type: "toggle", value: { index: 0, item: fileAt(0) } });
  registry.set(selection.command, { type: "range", index: 9 });
  expect(updates).toEqual(["file-0", "10 files selected"]);
  expect(indicators).toEqual([undefined, 0, undefined]);
  expect(describeFileInspection(target()!)).toEqual({
    type: "selection",
    label: "10 files selected",
  });

  expect(Selection.count(registry.get(selection.selection))).toBe(10);
  registry.set(selection.command, { type: "clear" });
  expect(updates).toEqual(["file-0", "10 files selected", undefined]);
  expect(target()).toBeUndefined();
  expect(Selection.count(registry.get(selection.selection))).toBe(0);
  expect(registry.get(selection.active)).toBe(9);

  registry.set(selection.command, { type: "activate" });
  expect(target()?.file?.name).toBe("file-9");
  registry.set(selection.command, { type: "all" });
  registry.set(selection.command, { type: "move", by: -1 });
  registry.set(selection.command, { type: "clear" });
  expect(target()).toBeUndefined();

  await vi.advanceTimersByTimeAsync(300);
  expect(target()).toBeUndefined();
  expect(registry.get(selection.active)).toBe(8);
});

it("derives a listing-scoped row indicator from the displayed inspection", async () => {
  const { registry, inspection, interact } = setup();
  const otherScope = Schema.decodeUnknownSync(ListingId)("other-listing");
  const inspected = inspection.inspectedIndex(listingId);
  const updates: Array<number | undefined> = [];
  registry.get(inspected);
  registry.subscribe(inspected, (name) => updates.push(name));

  interact(input("activate", 0));
  expect(registry.get(inspected)).toBe(0);
  expect(registry.get(inspection.inspectedIndex(otherScope))).toBeUndefined();

  interact(input("activate", 0));
  expect(updates).toEqual([0]);
  interact(input("focus", 1));
  await vi.advanceTimersByTimeAsync(249);
  expect(registry.get(inspected)).toBe(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(registry.get(inspected)).toBe(1);

  interact(input("select", 1, Selection.replace(listingId, [0, 1])));
  expect(registry.get(inspected)).toBeUndefined();
  interact(input("select", 1, Selection.replace(listingId, [0])));
  expect(registry.get(inspected)).toBe(0);
  interact(input("select", undefined));
  expect(registry.get(inspected)).toBeUndefined();

  interact(input("activate", 0, Selection.empty(otherScope)));
  expect(registry.get(inspected)).toBeUndefined();
  expect(registry.get(inspection.inspectedIndex(otherScope))).toBe(0);
});

it("clears inspection and pending navigation when leaving a listing", async () => {
  const { send, interact, target, updates, unmount } = setup();
  interact(input("activate", 0));
  interact(input("focus", 1));
  send({ type: "clear", scope: listingId });
  await vi.advanceTimersByTimeAsync(300);
  expect(target()).toBeUndefined();
  interact(input("activate", 2));
  interact(input("focus", 2));
  unmount();
  await vi.advanceTimersByTimeAsync(300);
  expect(updates).toEqual(["file-0", undefined, "file-2"]);
});

it("ignores an old listing cleanup after a new listing starts navigation", async () => {
  const { send, interact, target } = setup();
  const nextScope = Schema.decodeUnknownSync(ListingId)("next-listing");
  interact(input("activate", 0));
  interact(input("focus", 1, Selection.empty(nextScope)));
  send({ type: "clear", scope: listingId });

  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.file?.name).toBe("file-1");
  expect(target()?.selection.members.scope).toBe(nextScope);
});

it("retains only the latest target and distinguishes identical names across listing scopes", async () => {
  const { interact, target, updates } = setup();
  interact(input("activate", 0));
  interact(input("focus", 1));
  interact(input("focus", 0));
  await vi.advanceTimersByTimeAsync(250);
  expect(updates).toEqual(["file-0", "file-0"]);
  const nextScope = Schema.decodeUnknownSync(ListingId)("refreshed");
  interact(input("focus", 0, Selection.empty(nextScope)));
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.selection.members.scope).toBe(nextScope);
  interact({ ...input("activate", 0), folder: "/other" });
  expect(target()?.selection.folder).toBe("/other");
});
