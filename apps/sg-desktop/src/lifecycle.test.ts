import { join } from "node:path";
import { Application, Module } from "@stargeist/application";
import { app, type BrowserWindow } from "electron";
import { Context, Deferred, Effect, Fiber, Layer, Queue } from "effect";
import { beforeEach, expect, it, onTestFinished, vi } from "vite-plus/test";
import { runDesktop } from "./lifecycle";

const native = vi.hoisted(() => ({
  whenReady: vi.fn<() => Promise<void>>(),
  quit: vi.fn<() => void>(),
  exit: vi.fn<(code?: number) => void>(),
  getAllWindows: vi.fn<() => BrowserWindow[]>(),
  quitAccepted: vi.fn<() => void>(),
  setIcon: vi.fn(),
}));

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    app: Object.assign(new EventEmitter(), {
      whenReady: native.whenReady,
      quit: native.quit,
      exit: native.exit,
      isPackaged: false,
      getAppPath: () => "/stargeist",
      dock: { setIcon: native.setIcon },
    }),
    BrowserWindow: { getAllWindows: native.getAllWindows },
  };
});

class Backend extends Context.Service<Backend, { readonly failure: Effect.Effect<never, Error> }>()(
  "test/desktop/Backend",
) {}

class Windows extends Context.Service<Windows, { readonly open: Effect.Effect<void, Error> }>()(
  "test/desktop/Windows",
) {}

const signal = () => Effect.runSync(Deferred.make<void>());
const complete = (deferred: Deferred.Deferred<void>) =>
  Effect.runSync(Deferred.succeed(deferred, undefined));
const wait = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.timeout("3 seconds")));

function requestQuit() {
  const event = { preventDefault: vi.fn() };
  app.emit("before-quit", event);
  return event;
}

function desktop(
  options: {
    readonly initialize?: Effect.Effect<void, Error>;
    readonly release?: Effect.Effect<void>;
    readonly releaseWindow?: Effect.Effect<void>;
    readonly open?: Effect.Effect<void, Error> | undefined;
  } = {},
) {
  const events: string[] = [];
  const acquired = signal();
  const failure = Effect.runSync(Deferred.make<never, Error>());
  const opened = Effect.runSync(
    Queue.make<{
      readonly close: Deferred.Deferred<void>;
      readonly closed: Deferred.Deferred<void>;
    }>(),
  );
  let windowCount = 0;
  native.getAllWindows.mockImplementation(() =>
    Array.from({ length: windowCount }, () => ({}) as BrowserWindow),
  );

  const backend = Layer.effect(
    Backend,
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => events.push("backend acquired")),
        () =>
          (options.release ?? Effect.void).pipe(
            Effect.andThen(Effect.sync(() => events.push("backend released"))),
          ),
      );
      yield* Deferred.succeed(acquired, undefined);
      yield* options.initialize ?? Effect.void;
      return { failure: Deferred.await(failure) };
    }),
  );

  const open = Effect.gen(function* () {
    const close = yield* Deferred.make<void>();
    const closed = yield* Deferred.make<void>();
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        windowCount++;
        events.push("window opened");
      }),
      () =>
        Effect.sync(() => {
          windowCount--;
          events.push("window released");
        }).pipe(Effect.andThen(options.releaseWindow ?? Effect.void)),
    ).pipe(
      Effect.andThen(Queue.offer(opened, { close, closed })),
      Effect.andThen(Deferred.await(close)),
      Effect.scoped,
      Effect.ensuring(Deferred.succeed(closed, undefined)),
    );
  });

  const application = Application.define({
    modules: {
      backend: Module.define({ exports: Backend, layer: backend }),
      windows: Module.define({
        exports: Windows,
        layer: Layer.effect(
          Windows,
          Effect.map(Backend, () => ({ open: options.open ?? open })),
        ),
      }),
    },
    provide: backend,
  });

  const fiber = Effect.runFork(runDesktop(application));
  onTestFinished(() => Effect.runPromise(Fiber.interrupt(fiber)));
  return { events, acquired, failure, opened, fiber };
}

beforeEach(() => {
  app.removeAllListeners();
  vi.resetAllMocks();
  native.whenReady.mockResolvedValue(undefined);
  native.quit.mockImplementation(() => {
    if (requestQuit().preventDefault.mock.calls.length === 0) native.quitAccepted();
  });
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
});

it("waits for Electron readiness before initializing services or opening a window", async () => {
  vi.stubGlobal("process", { ...process, platform: "darwin" });
  const ready = Promise.withResolvers<void>();
  const requested = signal();
  native.whenReady.mockImplementation(() => {
    complete(requested);
    return ready.promise;
  });
  const runtime = desktop();
  await wait(Deferred.await(requested));
  expect(runtime.events).toEqual([]);
  expect(native.setIcon).not.toHaveBeenCalled();

  ready.resolve();
  await wait(Queue.take(runtime.opened));
  expect(runtime.events).toEqual(["backend acquired", "window opened"]);
  expect(native.setIcon).toHaveBeenCalledExactlyOnceWith(join("/stargeist", "icons", "icon.png"));

  expect(requestQuit().preventDefault).toHaveBeenCalledOnce();
  await wait(Fiber.join(runtime.fiber));
  expect(runtime.events).toEqual([
    "backend acquired",
    "window opened",
    "window released",
    "backend released",
  ]);
  expect(native.quit).toHaveBeenCalledOnce();
  expect(native.quitAccepted).toHaveBeenCalledOnce();
  expect(native.exit).not.toHaveBeenCalled();
  expect(app.eventNames()).toEqual([]);
});

it("accepts quit before Electron is ready without starting services", async () => {
  const requested = signal();
  native.whenReady.mockImplementation(() => {
    complete(requested);
    return new Promise(() => {});
  });
  const runtime = desktop();
  await wait(Deferred.await(requested));

  expect(requestQuit().preventDefault).toHaveBeenCalledOnce();
  await wait(Fiber.join(runtime.fiber));
  expect(runtime.events).toEqual([]);
  expect(native.quit).toHaveBeenCalledOnce();
  expect(native.quitAccepted).toHaveBeenCalledOnce();
  expect(native.exit).not.toHaveBeenCalled();
  expect(app.eventNames()).toEqual([]);
});

it("cancels unfinished initialization and waits for cleanup before allowing quit", async () => {
  const releasing = signal();
  const release = signal();
  const runtime = desktop({
    initialize: Effect.never,
    release: Deferred.succeed(releasing, undefined).pipe(Effect.andThen(Deferred.await(release))),
  });
  onTestFinished(() => {
    complete(release);
  });
  await wait(Deferred.await(runtime.acquired));

  expect(requestQuit().preventDefault).toHaveBeenCalledOnce();
  await wait(Deferred.await(releasing));
  expect(runtime.fiber.pollUnsafe()).toBeUndefined();
  expect(native.quit).not.toHaveBeenCalled();
  expect(requestQuit().preventDefault).toHaveBeenCalledOnce();

  complete(release);
  await wait(Fiber.join(runtime.fiber));
  expect(runtime.events).toEqual(["backend acquired", "backend released"]);
  expect(native.quit).toHaveBeenCalledOnce();
  expect(native.quitAccepted).toHaveBeenCalledOnce();
  expect(native.exit).not.toHaveBeenCalled();
  expect(app.eventNames()).toEqual([]);
  expect(requestQuit().preventDefault).not.toHaveBeenCalled();
});

it("keeps the backend on macOS and reopens a closed window on activation", async () => {
  vi.stubGlobal("process", { ...process, platform: "darwin" });
  const runtime = desktop();
  const first = await wait(Queue.take(runtime.opened));
  app.emit("activate");
  expect(runtime.events).toEqual(["backend acquired", "window opened"]);

  complete(first.close);
  await wait(Deferred.await(first.closed));
  app.emit("window-all-closed");
  expect(native.quit).not.toHaveBeenCalled();
  expect(runtime.events).toEqual(["backend acquired", "window opened", "window released"]);

  app.emit("activate");
  await wait(Queue.take(runtime.opened));
  requestQuit();
  await wait(Fiber.join(runtime.fiber));
  expect(runtime.events).toEqual([
    "backend acquired",
    "window opened",
    "window released",
    "window opened",
    "window released",
    "backend released",
  ]);
  expect(native.exit).not.toHaveBeenCalled();
});

it.each(["win32", "linux"])("quits after the last window closes on %s", async (platform) => {
  vi.stubGlobal("process", { ...process, platform });
  const runtime = desktop();
  const window = await wait(Queue.take(runtime.opened));
  complete(window.close);
  await wait(Deferred.await(window.closed));

  app.emit("window-all-closed");
  await wait(Fiber.join(runtime.fiber));
  expect(runtime.events).toEqual([
    "backend acquired",
    "window opened",
    "window released",
    "backend released",
  ]);
  expect(native.exit).not.toHaveBeenCalled();
  expect(native.quitAccepted).toHaveBeenCalledOnce();
  expect(app.eventNames()).toEqual([]);
});

it.each(["initialization", "window", "backend"])(
  "releases resources and exits unsuccessfully after %s fails",
  async (stage) => {
    const failure = new Error(`${stage} failed`);
    let options: Parameters<typeof desktop>[0] = {};
    if (stage === "initialization") options = { initialize: Effect.fail(failure) };
    if (stage === "window") options = { open: Effect.fail(failure) };
    const runtime = desktop(options);
    if (stage === "backend") {
      await wait(Queue.take(runtime.opened));
      Effect.runSync(Deferred.fail(runtime.failure, failure));
    }

    native.exit.mockImplementation(() => {
      expect(runtime.events.at(-1)).toBe("backend released");
      expect(app.eventNames()).toEqual([]);
    });
    await wait(Fiber.join(runtime.fiber));
    if (stage === "backend") {
      expect(runtime.events).toEqual([
        "backend acquired",
        "window opened",
        "window released",
        "backend released",
      ]);
    } else {
      expect(runtime.events).toEqual(["backend acquired", "backend released"]);
    }
    expect(native.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(native.quit).not.toHaveBeenCalled();
  },
);

it.each(["initialization", "window", "backend"])(
  "reports %s cleanup failure instead of accepting a successful quit",
  async (stage) => {
    const cleanup = Effect.die(new Error("Cleanup failed"));
    let options: Parameters<typeof desktop>[0] = { release: cleanup };
    if (stage === "window") {
      options = { releaseWindow: cleanup };
    }
    if (stage === "initialization") {
      options = { initialize: Effect.never, release: cleanup };
    }
    const runtime = desktop(options);
    if (stage === "initialization") {
      await wait(Deferred.await(runtime.acquired));
    } else {
      await wait(Queue.take(runtime.opened));
    }
    requestQuit();
    await wait(Fiber.join(runtime.fiber));

    expect(native.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(native.quitAccepted).not.toHaveBeenCalled();
    if (stage === "window") expect(runtime.events.at(-1)).toBe("backend released");
    expect(app.eventNames()).toEqual([]);
  },
);
