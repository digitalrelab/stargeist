import { Deferred, Effect } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import type { Extent } from "../pagination";

import { Selection, type Command, type Interaction, type Source } from "./index";

function setup(overrides: Partial<Source<string, string, Error, string>> = {}) {
  const received = Atom.make<Interaction<string, string, string> | undefined>(undefined);
  const reads: number[] = [];
  const ranges: Array<readonly [number, number]> = [];
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  const collection = Selection.create(
    {
      scope: "listing-a",
      extent: Atom.make<Extent>({ count: 5_000, hasMore: false }),
      keyOf: ({ item }: { item: string }) => item,
      read: (index: number) =>
        Effect.sync(() => {
          reads.push(index);
          return `file-${index}`;
        }),
      readRange: (from: number, to: number) =>
        Effect.sync(() => {
          ranges.push([from, to]);
          return Array.from({ length: to - from + 1 }, (_, i) => `file-${from + i}`);
        }),
      ...overrides,
    },
    received,
  );
  const unmount = registry.mount(collection.command);
  const send = (command: Command<string, string>) => registry.set(collection.command, command);
  const selected = () => registry.get(collection.selection);
  const active = () => registry.get(collection.active);
  const keys = () => {
    const value = selected();
    if (value.mode !== "explicit") {
      throw new Error("Expected explicit keys");
    }
    return [...value.keys].sort((a, b) => a.localeCompare(b));
  };
  return { registry, collection, received, send, unmount, selected, active, keys, reads, ranges };
}

describe("Collection navigation and selection", () => {
  it("moves focus without changing membership or emitting activation", () => {
    const { registry, send, active, selected, reads, received } = setup();
    send({ type: "replace", keys: ["file-42"] });
    const initial = selected();
    send({ type: "move", by: 1 });
    send({ type: "move", by: 1 });
    expect(active()).toBe(1);
    expect(selected()).toBe(initial);
    expect(registry.get(received)?.type).toBe("focus");
    send({ type: "first" });
    send({ type: "move", by: -1 });
    expect(active()).toBe(0);
    expect(reads).toEqual([0, 1, 0]);
    send({ type: "last" });
    send({ type: "move", by: 1 });
    expect(active()).toBe(4_999);
    expect(reads).toEqual([0, 1, 0, 4_999]);
  });

  it("toggles independently, activates explicitly, and clears without clearing focus", () => {
    const { registry, send, keys, active, received } = setup();
    send({ type: "focus", value: { index: 2, item: "file-2" } });
    send({ type: "toggle" });
    expect(keys()).toEqual(["file-2"]);
    expect(registry.get(received)?.type).toBe("select");
    send({ type: "activate" });
    expect(registry.get(received)).toMatchObject({
      type: "activate",
      focused: { index: 2, item: "file-2" },
    });
    send({ type: "move", by: 1 });
    send({ type: "toggle" });
    expect(keys()).toEqual(["file-2", "file-3"]);
    expect(registry.get(received)?.type).toBe("select");
    send({ type: "clear" });
    expect(keys()).toEqual([]);
    expect(active()).toBe(3);
    expect(registry.get(received)?.type).toBe("select");
  });

  it("selects an unknown collection without reading any pages and isolates listing scopes", () => {
    const first = setup({ extent: Atom.make<Extent>({ count: 256, hasMore: true }) });
    first.send({ type: "all" });
    expect(first.reads).toEqual([]);
    expect(first.ranges).toEqual([]);
    expect(Selection.contains(first.selected(), "file-4999")).toBe(true);
    first.send({ type: "toggle", value: { index: 2, item: "file-2" } });
    expect(Selection.contains(first.selected(), "file-2")).toBe(false);
    expect(Selection.count(first.selected(), 5_000)).toBe(4_999);
    const second = setup({ scope: "listing-b" });
    expect(Selection.contains(second.selected(), "file-4999")).toBe(false);
    expect(second.selected().scope).toBe("listing-b");
  });

  it("extends, shrinks, and reverses a range around its anchor using only added keys", () => {
    const { send, keys, ranges } = setup();
    send({ type: "focus", value: { index: 3, item: "file-3" } });
    send({ type: "move", by: 2, extend: true });
    expect(keys()).toEqual(["file-3", "file-4", "file-5"]);
    send({ type: "move", by: 1, extend: true });
    expect(keys()).toEqual(["file-3", "file-4", "file-5", "file-6"]);
    send({ type: "move", by: -2, extend: true });
    expect(keys()).toEqual(["file-3", "file-4"]);
    send({ type: "range", index: 1 });
    expect(keys()).toEqual(["file-1", "file-2", "file-3"]);
    expect(ranges).toEqual([
      [3, 5],
      [6, 6],
      [1, 2],
    ]);
    send({ type: "move", by: 1 });
    send({ type: "move", by: 1, extend: true });
    expect(keys()).toEqual(["file-1", "file-2", "file-3"]);
  });

  it("preserves an earlier group when a toggle establishes a new range anchor", () => {
    const { send, keys } = setup();
    send({ type: "focus", value: { index: 0, item: "file-0" } });
    send({ type: "range", index: 4 });
    send({ type: "toggle", value: { index: 7, item: "file-7" } });
    send({ type: "range", index: 9 });
    expect(keys()).toEqual([
      "file-0",
      "file-1",
      "file-2",
      "file-3",
      "file-4",
      "file-7",
      "file-8",
      "file-9",
    ]);
    send({ type: "move", by: -1, extend: true });
    expect(keys()).toEqual(["file-0", "file-1", "file-2", "file-3", "file-4", "file-7", "file-8"]);
  });

  it("ends a range when plain navigation reaches the collection boundary", () => {
    const { send, keys, reads } = setup({
      extent: Atom.make<Extent>({ count: 6, hasMore: false }),
    });
    send({ type: "focus", value: { index: 0, item: "file-0" } });
    send({ type: "range", index: 5 });
    send({ type: "move", by: 1 });
    expect(reads).toEqual([5]);
    send({ type: "move", by: -1, extend: true });
    expect(keys()).toEqual(["file-0", "file-1", "file-2", "file-3", "file-4", "file-5"]);
  });

  it("restores the previous membership when an overlapping range shrinks or reverses", () => {
    const { send, keys } = setup();
    send({ type: "replace", keys: ["file-1", "file-3", "file-9"] });
    send({ type: "focus", value: { index: 4, item: "file-4" } });
    send({ type: "range", index: 0 });
    expect(keys()).toEqual(["file-0", "file-1", "file-2", "file-3", "file-4", "file-9"]);
    send({ type: "range", index: 2 });
    expect(keys()).toEqual(["file-1", "file-2", "file-3", "file-4", "file-9"]);
    send({ type: "range", index: 6 });
    expect(keys()).toEqual(["file-1", "file-3", "file-4", "file-5", "file-6", "file-9"]);
  });

  it("retains select-all exclusions outside the range and restores them when it shrinks", () => {
    const { send, selected } = setup();
    send({ type: "all" });
    send({ type: "toggle", value: { index: 2, item: "file-2" } });
    send({ type: "toggle", value: { index: 8, item: "file-8" } });
    send({ type: "focus", value: { index: 1, item: "file-1" } });
    send({ type: "range", index: 4 });
    expect(selected().mode).toBe("all");
    expect(Selection.contains(selected(), "file-2")).toBe(true);
    expect(Selection.contains(selected(), "file-8")).toBe(false);
    expect(Selection.count(selected(), 5_000)).toBe(4_999);
    send({ type: "range", index: 1 });
    expect(Selection.contains(selected(), "file-2")).toBe(false);
    expect(Selection.contains(selected(), "file-8")).toBe(false);
    expect(Selection.count(selected(), 5_000)).toBe(4_998);
  });

  it("publishes each committed selection intent with one consistent focus and membership snapshot", async () => {
    const pending = Effect.runSync(Deferred.make<ReadonlyArray<string>>());
    const { registry, collection, received, send } = setup({
      readRange: () => Deferred.await(pending),
    });
    const interactions: Array<Interaction<string, string, string>> = [];
    onTestFinished(
      registry.subscribe(received, (value) => {
        if (value) {
          interactions.push(value);
        }
      }),
    );
    send({ type: "toggle", value: { index: 0, item: "file-0" } });
    send({ type: "range", index: 2 });
    expect(interactions.map((value) => value.type)).toEqual(["select"]);
    expect(interactions[0]?.focused?.index).toBe(0);
    expect(Selection.count(interactions[0]!.selection)).toBe(1);
    await Effect.runPromise(Deferred.succeed(pending, ["file-0", "file-1", "file-2"]));
    await Effect.runPromise(
      AtomRegistry.getResult(registry, collection.request, { suspendOnWaiting: true }),
    );
    expect(interactions.map((value) => value.type)).toEqual(["select", "select"]);
    expect(interactions[1]?.focused?.index).toBe(2);
    expect(Selection.count(interactions[1]!.selection)).toBe(3);
    expect(interactions[1]?.selection).toBe(registry.get(collection.selection));
    send({ type: "move", by: 1 });
    expect(interactions[2]?.type).toBe("focus");
    expect(interactions[2]?.focused?.index).toBe(3);
    expect(interactions[2]?.selection).toBe(interactions[1]?.selection);
    send({ type: "cancel" });
    expect(interactions).toHaveLength(3);
    send({ type: "all" });
    expect(interactions[3]?.type).toBe("select");
    expect(interactions[3]?.selection.mode).toBe("all");
  });

  it("keeps keyed subscribers quiet on focus movement and unrelated toggles", () => {
    const { registry, collection, send } = setup();
    const updates: boolean[] = [];
    registry.get(collection.isSelected("file-0"));
    const unsubscribe = registry.subscribe(collection.isSelected("file-0"), (value) =>
      updates.push(value),
    );
    onTestFinished(unsubscribe);
    send({ type: "move", by: 1 });
    send({ type: "move", by: 1 });
    send({ type: "toggle" });
    expect(updates).toEqual([]);
    send({ type: "all" });
    expect(updates).toEqual([true]);
    send({ type: "toggle", value: { index: 0, item: "file-0" } });
    expect(updates).toEqual([true, false]);
  });

  it("does not commit a stale asynchronous range after a newer selection intent", async () => {
    const pending = Effect.runSync(Deferred.make<ReadonlyArray<string>>());
    let cancelled = false;
    const { send, registry, collection, keys } = setup({
      readRange: () =>
        Deferred.await(pending).pipe(
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              cancelled = true;
            }),
          ),
        ),
    });
    send({ type: "focus", value: { index: 0, item: "file-0" } });
    send({ type: "range", index: 2 });
    expect(registry.get(collection.request).waiting).toBe(true);
    send({ type: "toggle", value: { index: 4, item: "file-4" } });
    expect(cancelled).toBe(true);
    await Effect.runPromise(Deferred.succeed(pending, ["file-0", "file-1", "file-2"]));
    expect(keys()).toEqual(["file-4"]);
  });

  it("keeps the previous selection on range failure and retries the same intent", async () => {
    const retries: boolean[] = [];
    const { send, registry, collection, keys } = setup({
      readRange: (_from, _to, { retry }) => {
        retries.push(retry);
        if (!retry) {
          return Effect.fail(new Error("Unavailable"));
        }
        return Effect.succeed(["file-0", "file-1"]);
      },
    });
    send({ type: "toggle", value: { index: 0, item: "file-0" } });
    send({ type: "range", index: 1 });
    expect(keys()).toEqual(["file-0"]);
    expect(registry.get(collection.request)._tag).toBe("Failure");
    send({ type: "retry" });
    await Effect.runPromise(AtomRegistry.getResult(registry, collection.request));
    expect(keys()).toEqual(["file-0", "file-1"]);
    expect(retries).toEqual([false, true]);
  });

  it("publishes resolved focus independently of selection and explicit activation", async () => {
    const pending = Effect.runSync(Deferred.make<string>());
    const { registry, collection, send, selected, received } = setup({
      read: () => Deferred.await(pending),
    });
    const focused: number[] = [];
    registry.get(collection.current);
    const unsubscribe = registry.subscribe(collection.current, (value) => {
      if (value) {
        focused.push(value.index);
      }
    });
    onTestFinished(unsubscribe);
    send({ type: "focus", value: { index: 0, item: "file-0" } });
    send({ type: "move", by: 1 });
    expect(registry.get(collection.active)).toBe(1);
    expect(registry.get(collection.current)).toEqual({ index: 0, item: "file-0" });
    expect(focused).toEqual([0]);
    await Effect.runPromise(Deferred.succeed(pending, "file-1"));
    await Effect.runPromise(
      AtomRegistry.getResult(registry, collection.request, { suspendOnWaiting: true }),
    );
    expect(registry.get(collection.current)).toEqual({ index: 1, item: "file-1" });
    expect(focused).toEqual([0, 1]);
    expect(Selection.count(selected())).toBe(0);
    expect(registry.get(received)?.type).toBe("focus");
    send({ type: "all" });
    send({ type: "toggle" });
    expect(focused).toEqual([0, 1]);
  });

  it("cancels pending activation when navigation moves elsewhere", async () => {
    const pending = Effect.runSync(Deferred.make<string>());
    const { registry, collection, send, active, received } = setup({
      read: () => Deferred.await(pending),
    });
    send({ type: "activate" });
    send({ type: "focus", value: { index: 4, item: "file-4" } });
    await Effect.runPromise(Deferred.succeed(pending, "late"));
    expect(active()).toBe(4);
    expect(registry.get(collection.current)).toEqual({ index: 4, item: "file-4" });
    expect(registry.get(received)?.type).toBe("focus");
  });

  it("deduplicates frontier reads, restores focus on an empty final page, and ignores empty collections", async () => {
    const pending = Effect.runSync(Deferred.make<string | undefined>());
    let reads = 0;
    const { registry, collection, send, active } = setup({
      extent: Atom.make<Extent>({ count: 1, hasMore: true }),
      read: () =>
        Effect.suspend(() => {
          reads++;
          return Deferred.await(pending);
        }),
    });
    send({ type: "focus", value: { index: 0, item: "file-0" } });
    send({ type: "move", by: 1 });
    send({ type: "move", by: 1 });
    expect(reads).toBe(1);
    await Effect.runPromise(Deferred.succeed(pending, undefined));
    await Effect.runPromise(
      AtomRegistry.getResult(registry, collection.request, { suspendOnWaiting: true }),
    );
    expect(active()).toBe(0);
    const empty = setup({ extent: Atom.make<Extent>({ count: 0, hasMore: false }) });
    empty.send({ type: "first" });
    empty.send({ type: "last" });
    expect(empty.active()).toBeUndefined();
    expect(empty.reads).toEqual([]);
  });

  it("cancels work on explicit cancellation and disposal", async () => {
    const disposed = Effect.runSync(Deferred.make<void>());
    let cancelled = 0;
    const { send, unmount, keys } = setup({
      read: () =>
        Effect.never.pipe(
          Effect.onInterrupt(() =>
            Effect.gen(function* () {
              cancelled++;
              if (cancelled === 2) {
                yield* Deferred.succeed(disposed, undefined);
              }
            }),
          ),
        ),
    });
    send({ type: "replace", keys: ["kept"] });
    send({ type: "first" });
    send({ type: "cancel" });
    expect(cancelled).toBe(1);
    expect(keys()).toEqual(["kept"]);
    send({ type: "first" });
    unmount();
    await Effect.runPromise(Deferred.await(disposed).pipe(Effect.timeout("3 seconds")));
    expect(cancelled).toBe(2);
  });
});
