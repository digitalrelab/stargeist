import { LibraryId, ListingId } from "@stargeist/domain";
import { Selection, type SelectionState } from "@stargeist/std/selection";
import { Effect, HashSet, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { expect, it, onTestFinished, vi } from "vite-plus/test";
import { createFileSelectionController } from "../../selection";
import { createFileListing } from "../../state";
import { createFileInspection, describeFileInspection, type FileInspectionInput } from "./state";

const libraryId = Schema.decodeUnknownSync(LibraryId)("lib_00000000000000000000000001");
const listingId = Schema.decodeUnknownSync(ListingId)("inspection");
const empty = Selection.empty<string, typeof listingId>(listingId);

function input(
  type: "focus" | "select" | "activate",
  index: number | undefined,
  selection: SelectionState<string, typeof listingId> = empty,
): FileInspectionInput {
  let focused;
  if (index !== undefined) {
    focused = { index, item: { name: `file-${index}`, kind: "file" as const } };
  }
  return { libraryId, folder: "/files", total: 10_000, interaction: { type, focused, selection } };
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

it("opens inspection from arrow navigation without changing checkbox selection", async () => {
  const { registry, inspection, send, interact, target } = setup();
  const listing = createFileListing(
    {
      listingId,
      entries: [0, 1, 2].map((index) => ({ name: `file-${index}`, kind: "file" as const })),
      offset: 0,
      hasMore: false,
    },
    () => Effect.die("Navigation must use the cached page"),
  );
  const selection = createFileSelectionController(listing);
  registry.mount(selection.command);
  registry.set(selection.command, { type: "replace", keys: ["file-2"] });
  const membership = registry.get(selection.selection);
  const navigate = (by: number) => {
    registry.set(selection.command, { type: "move", by });
    const interaction = registry.get(selection.interaction);
    if (!interaction) {
      throw new Error("Expected committed navigation intent");
    }
    interact({ ...input("focus", undefined), interaction });
  };
  expect(registry.get(inspection.isOpen)).toBe(false);
  navigate(1);
  expect(target()).toBeUndefined();
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.entry?.name).toBe("file-0");
  expect(registry.get(inspection.isOpen)).toBe(true);
  navigate(1);
  expect(registry.get(selection.active)).toBe(1);
  expect(target()?.entry?.name).toBe("file-0");
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.entry?.name).toBe("file-1");
  expect(registry.get(selection.selection)).toBe(membership);
  expect(Selection.count(membership)).toBe(1);
  expect(registry.get(selection.interaction)?.type).toBe("focus");
  send({ type: "close" });
  navigate(-1);
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.entry?.name).toBe("file-0");
  registry.set(selection.command, { type: "all" });
  const all = registry.get(selection.interaction)!;
  interact({ ...input("select", undefined), total: 3, interaction: all });
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
  expect(target()?.entry?.name).toBe("file-0");
  expect(registry.get(selection.selection).mode).toBe("all");
  navigate(1);
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.entry?.name).toBe("file-1");
});

it("inspects the navigated file inside or outside a group without changing its selection", async () => {
  const { interact, target, updates } = setup();
  const members = Selection.replace(listingId, ["file-0", "file-1"]);
  interact(input("select", 1, members));
  const group = target();
  expect(group?.files.members).toBe(members);
  expect(updates).toEqual(["2 files selected"]);
  interact(input("focus", 0, members));
  await vi.advanceTimersByTimeAsync(249);
  expect(target()).toBe(group);
  await vi.advanceTimersByTimeAsync(1);
  expect(target()?.entry?.name).toBe("file-0");
  interact(input("focus", 2, members));
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.entry?.name).toBe("file-2");
  expect(Selection.count(target()!.files.members)).toBe(1);
  expect(Selection.count(members)).toBe(2);
  interact(input("select", 1, members));
  expect(target()?.files.members).toBe(members);
  expect(updates).toEqual(["2 files selected", "file-0", "file-2", "2 files selected"]);
});

it("keeps select-all and exceptions compact, including an unknown total", async () => {
  const { interact, target, updates } = setup();
  const members = Selection.set(
    Selection.all<string, typeof listingId>(listingId),
    "file-5",
    false,
  );
  interact(input("select", 5, members));
  expect(target()?.files.members).toBe(members);
  expect(members.mode).toBe("all");
  if (members.mode !== "all") {
    throw new Error("Expected compact select-all");
  }
  expect(HashSet.size(members.excludedKeys)).toBe(1);
  expect(updates).toEqual(["9,999 files selected"]);
  interact({ ...input("select", undefined, members), total: undefined });
  expect(updates).toEqual(["9,999 files selected", "All files selected except 1"]);
  interact(input("focus", 5, members));
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.entry?.name).toBe("file-5");
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
  expect(target()?.entry?.name).toBe("file-9999");
  await vi.advanceTimersByTimeAsync(1);
  expect(updates).toEqual(["file-9999", "file-5009"]);
});

it("selection supersedes pending navigation, and activation explicitly inspects one group member", async () => {
  const { interact, target, updates } = setup();
  interact(input("activate", 0));
  interact(input("focus", 1));
  const members = Selection.replace(listingId, ["file-2", "file-3"]);
  interact(input("select", 3, members));
  expect(target()?.files.members).toBe(members);
  await vi.advanceTimersByTimeAsync(300);
  expect(updates).toEqual(["file-0", "2 files selected"]);
  interact(input("activate", 2, members));
  expect(target()?.entry?.name).toBe("file-2");
  expect(Selection.count(target()!.files.members)).toBe(1);
  expect(Selection.count(members)).toBe(2);
});

it("describes the remaining selected file and closes when selection becomes empty", () => {
  const { interact, target, updates } = setup();
  interact(input("select", 1, Selection.replace(listingId, ["file-0"])));
  expect(describeFileInspection(target()!)).toEqual({
    type: "file",
    name: "file-0",
    kind: undefined,
  });
  interact(input("select", 1));
  expect(target()).toBeUndefined();
  interact(input("select", undefined));
  expect(target()).toBeUndefined();
  expect(updates).toEqual(["file-0", undefined]);
});

it("publishes selection and inspection together, then closes without changing membership", async () => {
  const { registry, inspection, send, target, updates } = setup();
  const entries = Array.from({ length: 10 }, (_, index) => ({
    name: `file-${index}`,
    kind: "file" as const,
  }));
  const listing = createFileListing({ listingId, entries, offset: 0, hasMore: false }, () =>
    Effect.die("Selection must use the cached page"),
  );
  const onInteraction = Atom.writable(
    () => undefined,
    (ctx, interaction: FileInspectionInput["interaction"]) => {
      ctx.set(inspection.command, {
        type: "interact",
        input: { libraryId, folder: "/files", total: 10, interaction },
      });
    },
  );
  const selection = createFileSelectionController(listing, onInteraction);
  registry.mount(selection.command);
  const visibility: boolean[] = [];
  const indicators: Array<string | undefined> = [];

  registry.subscribe(inspection.isOpen, (open) => visibility.push(open), { immediate: true });
  registry.subscribe(inspection.inspectedName(listingId), (name) => indicators.push(name), {
    immediate: true,
  });

  registry.set(selection.command, { type: "toggle", value: { index: 0, item: entries[0]! } });
  registry.set(selection.command, { type: "range", index: 9 });
  expect(updates).toEqual(["file-0", "10 files selected"]);
  expect(visibility).toEqual([false, true]);
  expect(indicators).toEqual([undefined, "file-0", undefined]);
  expect(describeFileInspection(target()!)).toEqual({
    type: "selection",
    label: "10 files selected",
  });

  send({ type: "close" });
  expect(updates).toEqual(["file-0", "10 files selected", undefined]);
  expect(visibility).toEqual([false, true, false]);
  expect(target()).toBeUndefined();
  expect(Selection.count(registry.get(selection.selection))).toBe(10);
  await vi.advanceTimersByTimeAsync(300);
  expect(target()).toBeUndefined();
  registry.set(selection.command, { type: "clear" });
  expect(target()).toBeUndefined();
  expect(Selection.count(registry.get(selection.selection))).toBe(0);
  expect(registry.get(selection.active)).toBe(9);

  registry.set(selection.command, { type: "activate" });
  expect(target()?.entry?.name).toBe("file-9");
  registry.set(selection.command, { type: "all" });
  registry.set(selection.command, { type: "move", by: -1 });
  registry.set(selection.command, { type: "clear" });
  expect(target()).toBeUndefined();

  await vi.advanceTimersByTimeAsync(300);
  expect(target()).toBeUndefined();
  expect(registry.get(selection.active)).toBe(8);
});

it("closing cancels queued navigation and remains closed until a new intent", async () => {
  const { send, interact, target, updates } = setup();
  interact(input("activate", 0));
  interact(input("focus", 1));
  send({ type: "close" });
  await vi.advanceTimersByTimeAsync(300);
  expect(target()).toBeUndefined();
  expect(updates).toEqual(["file-0", undefined]);
  interact(input("focus", 2));
  await vi.advanceTimersByTimeAsync(250);
  expect(target()?.entry?.name).toBe("file-2");
});

it("derives a listing-scoped row indicator from the displayed inspection", async () => {
  const { registry, inspection, send, interact } = setup();
  const otherScope = Schema.decodeUnknownSync(ListingId)("other-listing");
  const inspected = inspection.inspectedName(listingId);
  const updates: Array<string | undefined> = [];
  registry.get(inspected);
  registry.subscribe(inspected, (name) => updates.push(name));

  interact(input("activate", 0));
  expect(registry.get(inspected)).toBe("file-0");
  expect(registry.get(inspection.inspectedName(otherScope))).toBeUndefined();

  interact(input("activate", 0));
  expect(updates).toEqual(["file-0"]);
  interact(input("focus", 1));
  await vi.advanceTimersByTimeAsync(249);
  expect(registry.get(inspected)).toBe("file-0");
  await vi.advanceTimersByTimeAsync(1);
  expect(registry.get(inspected)).toBe("file-1");

  interact(input("select", 1, Selection.replace(listingId, ["file-0", "file-1"])));
  expect(registry.get(inspected)).toBeUndefined();
  interact(input("select", 1, Selection.replace(listingId, ["file-0"])));
  expect(registry.get(inspected)).toBe("file-0");
  send({ type: "close" });
  expect(registry.get(inspected)).toBeUndefined();

  interact(input("activate", 0, Selection.empty(otherScope)));
  expect(registry.get(inspected)).toBeUndefined();
  expect(registry.get(inspection.inspectedName(otherScope))).toBe("file-0");
});

it("cancels pending navigation on departure and disposal while preserving displayed inspection", async () => {
  const { send, interact, target, updates, unmount } = setup();
  interact(input("activate", 0));
  interact(input("focus", 1));
  send({ type: "cancel" });
  await vi.advanceTimersByTimeAsync(300);
  expect(target()?.entry?.name).toBe("file-0");
  interact(input("focus", 2));
  await vi.advanceTimersByTimeAsync(250);
  interact(input("focus", 3));
  unmount();
  await vi.advanceTimersByTimeAsync(300);
  expect(updates).toEqual(["file-0", "file-2"]);
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
  expect(target()?.files.members.scope).toBe(nextScope);
  interact({ ...input("activate", 0), folder: "/other" });
  expect(target()?.files.folder).toBe("/other");
});
