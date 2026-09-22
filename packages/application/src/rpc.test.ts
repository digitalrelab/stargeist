import { Context, Deferred, Effect, Fiber, Layer, Queue, Schema } from "effect";
import { Rpc, RpcGroup, RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { expect, expectTypeOf, it } from "vite-plus/test";
import * as RpcEndpoint from "./rpc";

class Counter extends Context.Service<Counter, { readonly next: Effect.Effect<number> }>()(
  "test/EndpointCounter",
) {}
const contract = RpcGroup.make(Rpc.make("next", { success: Schema.Number }));

const idleProtocol = Effect.gen(function* () {
  const serialization = yield* RpcSerialization.RpcSerialization;
  return RpcServer.Protocol.of({
    run: () => Effect.never,
    disconnects: yield* Queue.make<number>(),
    send: () => Effect.void,
    end: () => Effect.void,
    clientIds: Effect.succeed(new Set<number>()),
    initialMessage: Effect.succeedNone,
    supportsAck: false,
    supportsTransferables: false,
    supportsSpanPropagation: false,
    supportsNotifications: false,
    codecFor: serialization.codecFor,
  });
}).pipe(Effect.provide(RpcSerialization.layerJson));

it("keeps the contract, startup errors, and unresolved dependencies typed", () => {
  const implementation = Effect.gen(function* () {
    const counter = yield* Counter;
    yield* Effect.fail("startup" as const);
    return { next: () => counter.next };
  });
  const endpoint = RpcEndpoint.define(contract)({ implementation, concurrency: 1 });
  expectTypeOf<Effect.Error<typeof endpoint.serve>>().toEqualTypeOf<"startup">();
  expectTypeOf<Effect.Services<typeof endpoint.serve>>().toEqualTypeOf<
    Counter | RpcServer.Protocol
  >();
  expectTypeOf(Layer.empty).not.toExtend<typeof endpoint.layer>();
  expectTypeOf(RpcGroup.make(Rpc.make("other")).toLayer({ other: () => Effect.void })).not.toExtend<
    typeof endpoint.layer
  >();
  const define = RpcEndpoint.define(contract);
  expectTypeOf({ other: () => Effect.void }).not.toExtend<
    Parameters<typeof define>[0]["implementation"]
  >();
  expectTypeOf({ next: () => Effect.succeed("wrong result") }).not.toExtend<
    Parameters<typeof define>[0]["implementation"]
  >();
  expect(endpoint.rpcs).toBe(contract);
});

it("gives each server its own handler scope and releases it before interruption completes", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const protocol = yield* idleProtocol;
      const acquired = yield* Queue.make<number>();
      let instances = 0;
      const released: number[] = [];
      const endpoint = RpcEndpoint.define(contract)({
        concurrency: 1,
        implementation: Effect.gen(function* () {
          const id = yield* Effect.acquireRelease(
            Effect.sync(() => ++instances),
            (id) =>
              Effect.sync(() => {
                released.push(id);
              }),
          );
          yield* Queue.offer(acquired, id);
          return { next: () => Effect.succeed(id) };
        }),
      });
      const serve = endpoint.serve.pipe(Effect.provideService(RpcServer.Protocol, protocol));
      const first = yield* serve.pipe(Effect.forkChild);
      expect(yield* Queue.take(acquired)).toBe(1);
      const second = yield* serve.pipe(Effect.forkChild);
      expect(yield* Queue.take(acquired)).toBe(2);
      yield* Fiber.interrupt(first);
      expect(released).toEqual([1]);
      yield* Fiber.interrupt(second);
      expect(released).toEqual([1, 2]);
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
});

it("releases acquired handler resources when startup fails", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const protocol = yield* idleProtocol;
      const released = yield* Deferred.make<void>();
      const endpoint = RpcEndpoint.define(contract)({
        concurrency: 1,
        implementation: Effect.gen(function* () {
          yield* Effect.acquireRelease(Effect.void, () => Deferred.succeed(released, undefined));
          return yield* Effect.fail("startup" as const);
        }),
      });
      expect(
        yield* endpoint.serve.pipe(
          Effect.provideService(RpcServer.Protocol, protocol),
          Effect.flip,
        ),
      ).toBe("startup");
      expect(yield* Deferred.isDone(released)).toBe(true);
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
});
