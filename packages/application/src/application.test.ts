import { Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { Application, Module } from "./index";

class Counter extends Context.Service<Counter, { readonly next: Effect.Effect<number> }>()(
  "test/Counter",
) {}
class Config extends Context.Service<Config, { readonly start: number }>()("test/Config") {}

describe("application", () => {
  it("is lazy, shares layers within an instance, and isolates owned state between instances", async () => {
    let acquired = 0;
    let released = 0;
    const counterLayer = Layer.effect(
      Counter,
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            acquired++;
          }),
          () =>
            Effect.sync(() => {
              released++;
            }),
        );
        let value = 0;
        return { next: Effect.sync(() => ++value) };
      }),
    );
    class Reader extends Context.Service<Reader, { readonly read: Effect.Effect<number> }>()(
      "test/Reader",
    ) {}
    const counter = Module.define({ exports: Counter, layer: counterLayer });
    const reader = Module.define({
      exports: Reader,
      layer: Layer.effect(
        Reader,
        Effect.map(Counter, (counter) => ({ read: counter.next })),
      ).pipe(Layer.provide(counter.layer)),
    });
    const application = Application.define({ modules: { counter, reader, alias: counter } });
    expect(acquired).toBe(0);

    await Effect.runPromise(
      Effect.gen(function* () {
        const ambient = yield* Counter;
        expect(yield* ambient.next).toBe(1);
        const first = yield* application.make;
        const second = yield* application.make;
        expect(first.alias).toBe(first.counter);
        expect(yield* first.counter.next).toBe(1);
        expect(yield* first.reader.read).toBe(2);
        expect(yield* second.reader.read).toBe(1);
        expect(acquired).toBe(3);
        expect(released).toBe(0);
      }).pipe(Effect.scoped, Effect.provide(counterLayer)),
    );

    expect(released).toBe(3);
  });

  it("exports only the chosen API and preserves dependency, operation, and startup error types", async () => {
    class Api extends Context.Service<
      Api,
      {
        readonly read: Effect.Effect<number, "read-failed", Config>;
      }
    >()("test/Api") {}
    const module = Module.define({
      exports: Api,
      layer: Layer.effect(
        Api,
        Effect.gen(function* () {
          const config = yield* Config;
          if (config.start < 0) return yield* Effect.fail("invalid-start" as const);
          return { read: Effect.map(Config, ({ start }) => start) };
        }),
      ),
    });
    const unresolved = Application.define({ modules: { api: module } });
    expectTypeOf<Effect.Services<typeof unresolved.make>>().toEqualTypeOf<Config | Scope.Scope>();
    expectTypeOf<Effect.Error<typeof unresolved.make>>().toEqualTypeOf<"invalid-start">();
    const application = Application.define({
      modules: { api: module },
      provide: Layer.succeed(Config, { start: 7 }),
    });
    expectTypeOf<Effect.Services<typeof application.make>>().toEqualTypeOf<Scope.Scope>();
    expectTypeOf<Effect.Success<typeof application.make>>().toEqualTypeOf<{
      readonly api: { readonly read: Effect.Effect<number, "read-failed", Config> };
    }>();
    expectTypeOf(Layer.succeed(Config, { start: 0 })).not.toExtend<
      Parameters<
        typeof Module.define<Api, Context.Service.Shape<typeof Api>, never, never>
      >[0]["layer"]
    >();

    await Effect.runPromise(
      Effect.gen(function* () {
        const instance = yield* application.make;
        expect(Object.keys(instance)).toEqual(["api"]);
        expect(yield* instance.api.read.pipe(Effect.provideService(Config, { start: 8 }))).toBe(8);
      }).pipe(Effect.scoped),
    );
  });

  it("keeps internal services from overwriting another module's public service", async () => {
    class Reader extends Context.Service<Reader, { readonly read: Effect.Effect<number> }>()(
      "test/PrivateReader",
    ) {}
    const reader = Module.define({
      exports: Reader,
      layer: Layer.effect(
        Reader,
        Effect.map(Counter, (counter) => ({ read: counter.next })),
      ).pipe(Layer.provideMerge(Layer.succeed(Counter, { next: Effect.succeed(2) }))),
    });
    expectTypeOf<Layer.Success<typeof reader.layer>>().toEqualTypeOf<Reader>();
    const application = Application.define({
      modules: {
        counter: Module.define({
          exports: Counter,
          layer: Layer.succeed(Counter, { next: Effect.succeed(1) }),
        }),
        reader,
      },
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const instance = yield* application.make;
        expect(yield* instance.counter.next).toBe(1);
        expect(yield* instance.reader.read).toBe(2);
      }).pipe(Effect.scoped),
    );
  });

  it("waits for asynchronous resource release before completing the owning scope", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const releasing = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const application = Application.define({
          modules: {
            counter: Module.define({
              exports: Counter,
              layer: Layer.effect(
                Counter,
                Effect.acquireRelease(Effect.succeed({ next: Effect.succeed(1) }), () =>
                  Deferred.succeed(releasing, undefined).pipe(
                    Effect.andThen(Deferred.await(release)),
                  ),
                ),
              ),
            }),
          },
        });
        const fiber = yield* application.make.pipe(Effect.scoped, Effect.forkChild);
        yield* Deferred.await(releasing);
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(fiber);
      }).pipe(Effect.scoped),
    );
  });

  it("releases acquired resources on startup failure even when the parent scope stays open", async () => {
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
      }).pipe(Effect.scoped),
    );
  });

  it("cancels initialization and releases resources before interruption completes", async () => {
    let released = false;
    await Effect.runPromise(
      Effect.gen(function* () {
        const acquired = yield* Deferred.make<void>();
        const application = Application.define({
          modules: {
            counter: Module.define({
              exports: Counter,
              layer: Layer.effect(
                Counter,
                Effect.gen(function* () {
                  yield* Effect.acquireRelease(Effect.void, () =>
                    Effect.sync(() => {
                      released = true;
                    }),
                  );
                  yield* Deferred.succeed(acquired, undefined);
                  return yield* Effect.never;
                }),
              ),
            }),
          },
        });
        const fiber = yield* application.make.pipe(Effect.forkChild);
        yield* Deferred.await(acquired);
        yield* Fiber.interrupt(fiber);
        expect(released).toBe(true);
      }).pipe(Effect.scoped),
    );
  });

  it("rejects competing public implementations of the same service", () => {
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
