import { Context, Deferred, Effect, Exit, Fiber, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { Application, Module } from "./index";

class Counter extends Context.Service<Counter, { readonly next: Effect.Effect<number> }>()(
  "test/Counter",
) {}
class Reader extends Context.Service<Reader, { readonly read: Effect.Effect<number> }>()(
  "test/Reader",
) {}
class Config extends Context.Service<Config, { readonly start: number }>()("test/Config") {}

function trackedCounter() {
  const lifecycle = { acquired: 0, released: 0 };
  const layer = Layer.effect(
    Counter,
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          lifecycle.acquired++;
        }),
        () =>
          Effect.sync(() => {
            lifecycle.released++;
          }),
      );

      let value = 0;
      return { next: Effect.sync(() => ++value) };
    }),
  );

  return { layer, lifecycle };
}

describe("application lifetime", () => {
  it("acquires lazily and shares dependencies and aliases within one instance", async () => {
    const { layer, lifecycle } = trackedCounter();
    const counter = Module.define({ exports: Counter, layer });
    const reader = Module.define({
      exports: Reader,
      layer: Layer.effect(
        Reader,
        Effect.map(Counter, (counter) => ({ read: counter.next })),
      ).pipe(Layer.provide(counter.layer)),
    });
    const application = Application.define({ modules: { counter, reader, alias: counter } });

    expect(lifecycle).toEqual({ acquired: 0, released: 0 });

    await Effect.runPromise(
      Effect.gen(function* () {
        const instance = yield* application.make;

        expect(instance.alias).toBe(instance.counter);
        expect(yield* instance.counter.next).toBe(1);
        expect(yield* instance.reader.read).toBe(2);
        expect(lifecycle).toEqual({ acquired: 1, released: 0 });
      }).pipe(Effect.scoped),
    );

    expect(lifecycle).toEqual({ acquired: 1, released: 1 });
  });

  it("isolates owned state from ambient services and other application instances", async () => {
    const { layer, lifecycle } = trackedCounter();
    const counter = Module.define({ exports: Counter, layer });
    const application = Application.define({ modules: { counter } });

    await Effect.runPromise(
      Effect.gen(function* () {
        const ambient = yield* Counter;
        const first = yield* application.make;
        const second = yield* application.make;

        expect(yield* ambient.next).toBe(1);
        expect(yield* first.counter.next).toBe(1);
        expect(yield* second.counter.next).toBe(1);
        expect(yield* first.counter.next).toBe(2);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );

    expect(lifecycle).toEqual({ acquired: 3, released: 3 });
  });

  it("waits for asynchronous resource release before completing its scope", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const releasing = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const resource = Effect.acquireRelease(Effect.succeed({ next: Effect.succeed(1) }), () =>
          Deferred.succeed(releasing, undefined).pipe(Effect.andThen(Deferred.await(release))),
        );
        const counter = Module.define({ exports: Counter, layer: Layer.effect(Counter, resource) });
        const application = Application.define({ modules: { counter } });

        const fiber = yield* application.make.pipe(Effect.scoped, Effect.forkChild);
        yield* Deferred.await(releasing);

        expect(fiber.pollUnsafe()).toBeUndefined();

        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(fiber);
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });

  it("releases resources on startup failure while the parent scope remains open", async () => {
    let released = false;

    await Effect.runPromise(
      Effect.gen(function* () {
        const acquired = yield* Deferred.make<void>();
        const resource = Layer.effect(
          Counter,
          Effect.gen(function* () {
            yield* Effect.acquireRelease(Effect.void, () =>
              Effect.sync(() => {
                released = true;
              }),
            );
            yield* Deferred.succeed(acquired, undefined);
            return { next: Effect.succeed(1) };
          }),
        );
        const failure = Layer.effect(
          Config,
          Deferred.await(acquired).pipe(Effect.andThen(Effect.fail("startup-failed" as const))),
        );
        const application = Application.define({
          modules: {
            counter: Module.define({ exports: Counter, layer: resource }),
            config: Module.define({ exports: Config, layer: failure }),
          },
        });

        const result = yield* Effect.exit(application.make);

        expect(result).toEqual(Exit.fail("startup-failed"));
        expect(released).toBe(true);
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });

  it("releases resources before initialization cancellation completes", async () => {
    let released = false;

    await Effect.runPromise(
      Effect.gen(function* () {
        const acquired = yield* Deferred.make<void>();
        const initializing = Effect.gen(function* () {
          yield* Effect.acquireRelease(Effect.void, () =>
            Effect.sync(() => {
              released = true;
            }),
          );
          yield* Deferred.succeed(acquired, undefined);
          return yield* Effect.never;
        });
        const counter = Module.define({
          exports: Counter,
          layer: Layer.effect(Counter, initializing),
        });
        const application = Application.define({ modules: { counter } });

        const fiber = yield* application.make.pipe(Effect.forkChild);
        yield* Deferred.await(acquired);
        yield* Fiber.interrupt(fiber);

        expect(released).toBe(true);
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });

  it("rejects competing implementations of the same public service", () => {
    const first = Module.define({
      exports: Counter,
      layer: Layer.succeed(Counter, { next: Effect.succeed(1) }),
    });
    const second = Module.define({
      exports: Counter,
      layer: Layer.succeed(Counter, { next: Effect.succeed(2) }),
    });

    expect(() => Application.define({ modules: { first, second } })).toThrow(
      'Modules "first" and "second" export the same service "test/Counter"',
    );
  });
});
