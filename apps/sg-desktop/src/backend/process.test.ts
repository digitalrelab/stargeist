import { EventEmitter } from "node:events";
import { Cause, Deferred, Effect, Fiber } from "effect";
import { beforeEach, expect, it, onTestFinished, vi } from "vite-plus/test";
import { startBackendProcess } from "./process";

const native = vi.hoisted(() => ({ fork: vi.fn() }));

vi.mock("electron", () => ({
  app: { getPath: () => "/test-profile" },
  utilityProcess: { fork: native.fork },
}));

const signal = () => Effect.runSync(Deferred.make<void>());
const complete = (deferred: Deferred.Deferred<void>) =>
  Effect.runSync(Deferred.succeed(deferred, undefined));
const wait = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.timeout("3 seconds")));

function backend() {
  const forked = signal();
  const stopRequested = signal();
  const child = Object.assign(new EventEmitter(), {
    pid: undefined as number | undefined,
    postMessage: vi.fn(() => complete(stopRequested)),
    kill: vi.fn(() => true),
  });
  native.fork.mockImplementation(() => {
    complete(forked);
    return child;
  });

  const fiber = Effect.runFork(startBackendProcess.pipe(Effect.scoped));
  onTestFinished(async () => {
    child.emit("exit", 0);
    await Effect.runPromise(Fiber.interrupt(fiber));
  });
  return { child, fiber, forked, stopRequested };
}

beforeEach(() => {
  vi.resetAllMocks();
  onTestFinished(() => {
    vi.useRealTimers();
  });
});

it("waits for a backend cancelled before spawn to stop", async () => {
  const runtime = backend();
  await wait(Deferred.await(runtime.forked));
  const stopping = Effect.runFork(Fiber.interrupt(runtime.fiber));
  await wait(Deferred.await(runtime.stopRequested));

  expect(runtime.child.pid).toBeUndefined();
  expect(runtime.child.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "stop" });
  expect(stopping.pollUnsafe()).toBeUndefined();

  runtime.child.pid = 123;
  runtime.child.emit("spawn");
  runtime.child.emit("exit", 0);
  await wait(Fiber.join(stopping));
  expect(runtime.child.kill).not.toHaveBeenCalled();
  expect(runtime.child.eventNames()).toEqual([]);
});

it("does not send shutdown messages to a backend that already exited", async () => {
  const runtime = backend();
  await wait(Deferred.await(runtime.forked));
  runtime.child.emit("exit", 1);

  const exit = await wait(Fiber.await(runtime.fiber));
  expect(exit._tag).toBe("Failure");
  expect(runtime.child.postMessage).not.toHaveBeenCalled();
  expect(runtime.child.kill).not.toHaveBeenCalled();
  expect(runtime.child.eventNames()).toEqual([]);
});

it("waits for exit after the graceful shutdown deadline requires termination", async () => {
  vi.useFakeTimers();
  const runtime = backend();
  await Effect.runPromise(Deferred.await(runtime.forked));
  runtime.child.pid = 123;
  const stopping = Effect.runFork(Fiber.interrupt(runtime.fiber));
  await Effect.runPromise(Deferred.await(runtime.stopRequested));

  await vi.advanceTimersByTimeAsync(5000);
  expect(runtime.child.kill).toHaveBeenCalledOnce();
  expect(stopping.pollUnsafe()).toBeUndefined();

  runtime.child.emit("exit", 0);
  await Effect.runPromise(Fiber.join(stopping));
  expect(runtime.child.eventNames()).toEqual([]);
});

it.each([true, false])("reports missing exit after termination returns %s", async (accepted) => {
  vi.useFakeTimers();
  const runtime = backend();
  await Effect.runPromise(Deferred.await(runtime.forked));
  runtime.child.kill.mockReturnValue(accepted);
  const stopping = Effect.runFork(Fiber.interrupt(runtime.fiber));
  await Effect.runPromise(Deferred.await(runtime.stopRequested));

  await vi.advanceTimersByTimeAsync(10000);
  await Effect.runPromise(Fiber.join(stopping));
  const exit = await Effect.runPromise(Fiber.await(runtime.fiber));
  expect(exit._tag).toBe("Failure");
  if (exit._tag === "Failure") expect(Cause.hasDies(exit.cause)).toBe(true);
  expect(runtime.child.eventNames()).toEqual([]);
});
