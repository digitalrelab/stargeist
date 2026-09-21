import { Context, Effect, Layer, Scope } from "effect";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { Application, Module } from "./index";

class Counter extends Context.Service<Counter, { readonly next: Effect.Effect<number> }>()(
  "test/Counter",
) {}
class Config extends Context.Service<Config, { readonly start: number }>()("test/Config") {}

describe("module boundaries", () => {
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
    expectTypeOf<Layer.Services<typeof unresolved.layer>>().toEqualTypeOf<Config>();
    expectTypeOf<Layer.Error<typeof unresolved.layer>>().toEqualTypeOf<"invalid-start">();
    expectTypeOf<Layer.Success<typeof unresolved.layer>>().toEqualTypeOf<Api>();
    expectTypeOf<Effect.Services<typeof unresolved.make>>().toEqualTypeOf<Config | Scope.Scope>();
    expectTypeOf<Effect.Error<typeof unresolved.make>>().toEqualTypeOf<"invalid-start">();
    const application = Application.define({
      modules: { api: module },
      provide: Layer.succeed(Config, { start: 7 }),
    });
    expectTypeOf<Layer.Services<typeof application.layer>>().toEqualTypeOf<never>();
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
});
