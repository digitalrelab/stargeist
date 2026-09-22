import { Effect } from "effect";
import { type Rpc, type RpcGroup, RpcServer } from "effect/unstable/rpc";

/**
 * Binds an RPC contract to its implementation and a scoped server.
 * Each execution of `serve` acquires its own handler resources and releases them
 * when interrupted. Service dependencies remain in the Effect requirement type.
 */
export const define =
  <Rpcs extends Rpc.Any>(rpcs: RpcGroup.RpcGroup<Rpcs>) =>
  <Handlers extends RpcGroup.HandlersFrom<Rpcs>, E = never, R = never>(options: {
    readonly implementation: Handlers | Effect.Effect<Handlers, E, R>;
    readonly concurrency: number;
  }) => {
    const layer = rpcs.toLayer(options.implementation);
    return Object.freeze({
      rpcs,
      layer,
      serve: RpcServer.make(rpcs, { concurrency: options.concurrency }).pipe(
        Effect.provide(layer),
        Effect.scoped,
      ),
    });
  };
