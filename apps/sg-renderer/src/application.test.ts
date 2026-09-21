import { clientProtocol } from "@stargeist/std/rpc";
import { Deferred, Effect, Layer } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { expect, it, onTestFinished } from "vite-plus/test";
import { DesktopConnection } from "#src/desktop/index.ts";
import { ClientUnavailableError } from "#src/rpc/index.ts";
import { createRendererApplication } from "./application";

it("keeps one connection alive across subscribers and closes it with the application registry", async () => {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  let acquired = 0;
  const released = Effect.runSync(Deferred.make<void>());
  const connection = Layer.effect(
    DesktopConnection,
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          acquired++;
        }),
        () => Deferred.succeed(released, undefined),
      );
      const protocol = yield* clientProtocol({
        closed: Effect.never,
        send: () => {},
        listen: () => () => {},
        close: () => {},
      });
      return { backend: protocol, host: protocol };
    }),
  );
  const startup = Atom.make(createRendererApplication(connection).make).pipe(Atom.keepAlive);
  const unmount = registry.mount(startup);
  const first = await Effect.runPromise(AtomRegistry.getResult(registry, startup));
  unmount();
  registry.mount(startup);
  const second = await Effect.runPromise(AtomRegistry.getResult(registry, startup));

  expect(second).toBe(first);
  expect(acquired).toBe(1);
  expect(Effect.runSync(Deferred.isDone(released))).toBe(false);
  registry.dispose();
  await Effect.runPromise(Deferred.await(released).pipe(Effect.timeout("3 seconds")));
});

it("cancels an unfinished startup and releases its resources", async () => {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  const acquired = Effect.runSync(Deferred.make<void>());
  const released = Effect.runSync(Deferred.make<void>());
  const connection = Layer.effect(
    DesktopConnection,
    Effect.acquireRelease(Deferred.succeed(acquired, undefined), () =>
      Deferred.succeed(released, undefined),
    ).pipe(Effect.andThen(Effect.never)),
  );
  const startup = Atom.make(createRendererApplication(connection).make).pipe(Atom.keepAlive);
  registry.mount(startup);
  await Effect.runPromise(Deferred.await(acquired).pipe(Effect.timeout("3 seconds")));
  registry.dispose();
  await Effect.runPromise(Deferred.await(released).pipe(Effect.timeout("3 seconds")));
});

it("releases a failed startup before retrying the connection", async () => {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  let acquired = 0;
  let released = 0;
  const failure = new ClientUnavailableError({ message: "Connection failed" });
  const connection = Layer.effect(
    DesktopConnection,
    Effect.acquireRelease(
      Effect.sync(() => {
        acquired++;
      }),
      () =>
        Effect.sync(() => {
          released++;
        }),
    ).pipe(Effect.andThen(Effect.fail(failure))),
  );
  const startup = Atom.make(createRendererApplication(connection).make).pipe(Atom.keepAlive);
  registry.mount(startup);

  const readFailure = () =>
    Effect.runPromise(
      AtomRegistry.getResult(registry, startup, { suspendOnWaiting: true }).pipe(Effect.flip),
    );
  expect(await readFailure()).toBe(failure);
  expect({ acquired, released }).toEqual({ acquired: 1, released: 1 });
  registry.refresh(startup);
  expect(await readFailure()).toBe(failure);
  expect({ acquired, released }).toEqual({ acquired: 2, released: 2 });
});
