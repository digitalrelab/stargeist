import { Deferred, Effect } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import * as Pagination from "./pagination";

const first = { items: ["a", "b"], next: 2 };
const last = { items: ["c"], next: null };

function createRegistry() {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  return registry;
}

describe("Cursor pagination", () => {
  it("does not expose a previous source's page while its replacement is loading", async () => {
    const registry = createRegistry();
    const pending = Effect.runSync(Deferred.make<Pagination.Page<string, "next">>());
    const paging = Pagination.make({
      initial: { items: ["a"], next: "next" },
      read: (_cursor: string) => Effect.succeed({ items: ["old"], next: null }),
    });
    registry.mount(paging.initial);
    const page = paging.pages("next");
    registry.mount(page);

    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, page)).toEqual({
          items: ["old"],
          next: null,
        });
        registry.set(paging.reset, {
          initial: { items: ["x"], next: "next" },
          read: () => Deferred.await(pending),
        });
        expect(registry.get(page)._tag).toBe("Initial");
        yield* Deferred.succeed(pending, { items: ["new"], next: null });
        expect(yield* AtomRegistry.getResult(registry, page)).toEqual({
          items: ["new"],
          next: null,
        });
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("uses opaque continuation tokens and supports variable and empty pages", async () => {
    const registry = createRegistry();
    const requests: string[] = [];
    const paging = Pagination.make({
      initial: { items: ["a"], next: "after:a" },
      read: (cursor: string) =>
        Effect.sync(() => {
          requests.push(cursor);
          if (cursor === "after:a") return { items: [], next: "batch:3" };
          return { items: ["b", "c", "d"], next: null };
        }),
    });
    registry.mount(paging.initial);

    await Effect.runPromise(
      Effect.gen(function* () {
        const initial = registry.get(paging.initial);
        expect(initial.items).toEqual(["a"]);
        const middle = yield* AtomRegistry.getResult(registry, paging.pages(initial.next!));
        expect(middle).toEqual({ items: [], next: "batch:3" });
        const end = yield* AtomRegistry.getResult(registry, paging.pages(middle.next!));
        expect(end).toEqual({ items: ["b", "c", "d"], next: null });
        expect(requests).toEqual(["after:a", "batch:3"]);
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("invalidates a pending cursor read when the source changes", async () => {
    const registry = createRegistry();
    const canceled = Effect.runSync(Deferred.make<void>());
    const paging = Pagination.make({
      initial: { items: ["a"], next: "next" },
      read: (_cursor: string) =>
        Effect.never.pipe(Effect.ensuring(Deferred.succeed(canceled, undefined))),
    });
    registry.mount(paging.initial);
    registry.mount(paging.pages("next"));
    registry.set(paging.reset, {
      initial: { items: ["x"], next: "next" },
      read: () => Effect.succeed({ items: ["y"], next: null }),
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Deferred.await(canceled);
        expect(registry.get(paging.initial).items).toEqual(["x"]);
        expect(
          yield* AtomRegistry.getResult(registry, paging.pages("next"), {
            suspendOnWaiting: true,
          }),
        ).toEqual({ items: ["y"], next: null });
      }).pipe(Effect.timeout("3 seconds")),
    );
  });
});

describe("Indexed pagination", () => {
  it("shares concurrent reads and keeps the initial page available without fetching", async () => {
    const registry = createRegistry();
    const response = Effect.runSync(Deferred.make<Pagination.Page<string, number>>());
    let requests = 0;
    const paging = Pagination.makeIndexed({
      pageSize: 2,
      source: {
        initial: first,
        cursorAt: (offset) => offset,
        read: () => Effect.sync(() => requests++).pipe(Effect.andThen(Deferred.await(response))),
      },
    });
    registry.mount(paging.extent);

    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, paging.pages(0))).toEqual(first);
        expect(requests).toBe(0);
        expect([0, 1, 2, 3, 4].map(paging.pageOffset)).toEqual([0, 0, 2, 2, 4]);

        registry.mount(paging.pages(2));
        registry.mount(paging.pages(2));
        expect(requests).toBe(1);
        yield* Deferred.succeed(response, last);
        expect(yield* AtomRegistry.getResult(registry, paging.pages(2))).toEqual(last);
        expect(registry.get(paging.extent)).toEqual({ count: 3, hasMore: false });
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("retries a failed page without discarding loaded entries", async () => {
    const registry = createRegistry();
    const failure = new Error("Unavailable");
    let available = false;
    const paging = Pagination.makeIndexed({
      pageSize: 2,
      source: {
        initial: first,
        cursorAt: (offset) => offset,
        read: () =>
          Effect.suspend(() => {
            if (!available) return Effect.fail(failure);
            return Effect.succeed(last);
          }),
      },
    });
    registry.mount(paging.extent);
    const page = paging.pages(2);
    registry.mount(page);

    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, page).pipe(Effect.flip)).toBe(failure);
        expect(registry.get(paging.extent)).toEqual({ count: 2, hasMore: true });
        expect(yield* AtomRegistry.getResult(registry, paging.pages(0))).toEqual(first);
        available = true;
        registry.refresh(page);
        expect(yield* AtomRegistry.getResult(registry, page, { suspendOnWaiting: true })).toEqual(
          last,
        );
        expect(registry.get(paging.extent)).toEqual({ count: 3, hasMore: false });
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("does not reopen a confirmed end when an earlier full page is reread", async () => {
    const registry = createRegistry();
    const paging = Pagination.makeIndexed({
      pageSize: 2,
      source: {
        initial: first,
        cursorAt: (offset) => offset,
        read: (offset) => {
          if (offset === 2) return Effect.succeed({ items: ["c", "d"], next: 4 });
          return Effect.succeed({ items: [], next: null });
        },
      },
    });
    registry.mount(paging.extent);
    registry.mount(paging.pages(2));

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* AtomRegistry.getResult(registry, paging.pages(2));
        yield* AtomRegistry.getResult(registry, paging.pages(4));
        expect(registry.get(paging.extent)).toEqual({ count: 4, hasMore: false });
        registry.refresh(paging.pages(2));
        yield* AtomRegistry.getResult(registry, paging.pages(2), { suspendOnWaiting: true });
        expect(registry.get(paging.extent)).toEqual({ count: 4, hasMore: false });
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("cancels a read when its last observer leaves", async () => {
    const registry = createRegistry();
    const canceled = Effect.runSync(Deferred.make<void>());
    const paging = Pagination.makeIndexed({
      pageSize: 2,
      source: {
        initial: first,
        cursorAt: (offset) => offset,
        read: () => Effect.never.pipe(Effect.ensuring(Deferred.succeed(canceled, undefined))),
      },
    });
    registry.mount(paging.extent);
    const firstObserver = registry.mount(paging.pages(2));
    const secondObserver = registry.mount(paging.pages(2));
    firstObserver();
    expect(Effect.runSync(Deferred.isDone(canceled))).toBe(false);
    secondObserver();
    await Effect.runPromise(Deferred.await(canceled).pipe(Effect.timeout("3 seconds")));
  });

  it("releases unobserved pages and fetches them again without losing the known extent", async () => {
    const registry = createRegistry();
    const removed = Effect.runSync(Deferred.make<void>());
    let requests = 0;
    const paging = Pagination.makeIndexed({
      pageSize: 2,
      source: {
        initial: first,
        cursorAt: (offset) => offset,
        read: () =>
          Effect.sync(() => {
            requests++;
            return last;
          }),
      },
    });
    registry.mount(paging.extent);
    const page = paging.pages(2);
    registry.onNodeRemoved = (node) => {
      if (node.atom === page) Effect.runSync(Deferred.succeed(removed, undefined));
    };
    const unmount = registry.mount(page);

    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, page)).toEqual(last);
        unmount();
        yield* Deferred.await(removed);
        expect(registry.get(paging.extent)).toEqual({ count: 3, hasMore: false });
        expect(yield* AtomRegistry.getResult(registry, page)).toEqual(last);
        expect(requests).toBe(2);
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("resets the source, cancels old reads, and isolates registries", async () => {
    const registry = createRegistry();
    const otherRegistry = createRegistry();
    const canceled = Effect.runSync(Deferred.make<void>());
    const paging = Pagination.makeIndexed({
      pageSize: 2,
      source: {
        initial: first,
        cursorAt: (offset) => offset,
        read: () => Effect.never.pipe(Effect.ensuring(Deferred.succeed(canceled, undefined))),
      },
    });
    registry.mount(paging.extent);
    otherRegistry.mount(paging.extent);
    registry.mount(paging.pages(2));

    const replacement = { items: ["x", "y"], next: 2 };
    registry.set(paging.reset, {
      initial: replacement,
      cursorAt: (offset) => offset,
      read: () => Effect.succeed(last),
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Deferred.await(canceled);
        expect(yield* AtomRegistry.getResult(registry, paging.pages(0))).toEqual(replacement);
        expect(
          yield* AtomRegistry.getResult(registry, paging.pages(2), { suspendOnWaiting: true }),
        ).toEqual(last);
        expect(registry.get(paging.extent)).toEqual({ count: 3, hasMore: false });
        expect(yield* AtomRegistry.getResult(otherRegistry, paging.pages(0))).toEqual(first);
        expect(otherRegistry.get(paging.extent)).toEqual({ count: 2, hasMore: true });
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("rejects invalid or skipped offsets before fetching", async () => {
    const registry = createRegistry();
    let requests = 0;
    const paging = Pagination.makeIndexed({
      pageSize: 2,
      source: {
        initial: first,
        cursorAt: (offset) => offset,
        read: () =>
          Effect.sync(() => {
            requests++;
            return last;
          }),
      },
    });
    registry.mount(paging.extent);

    await Effect.runPromise(
      Effect.gen(function* () {
        for (const offset of [-2, 1, 4, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
          const error = yield* AtomRegistry.getResult(registry, paging.pages(offset)).pipe(
            Effect.flip,
          );
          expect(error).toMatchObject({ code: "InvalidOffset" });
        }
        expect(requests).toBe(0);
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("rejects malformed pages without advancing the extent", async () => {
    const registry = createRegistry();
    const paging = Pagination.makeIndexed({
      pageSize: 2,
      source: {
        initial: first,
        cursorAt: (offset) => offset,
        read: () => Effect.succeed({ items: ["c"], next: 4 }),
      },
    });
    registry.mount(paging.extent);
    const error = await Effect.runPromise(
      AtomRegistry.getResult(registry, paging.pages(2)).pipe(
        Effect.flip,
        Effect.timeout("3 seconds"),
      ),
    );
    expect(error).toMatchObject({ code: "InvalidPage" });
    expect(registry.get(paging.extent)).toEqual({ count: 2, hasMore: true });
  });
});
