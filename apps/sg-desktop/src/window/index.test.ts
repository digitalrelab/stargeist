import { EventEmitter } from "node:events";
import { Application } from "@stargeist/application";
import {
  UserPreferences,
  UserPreferencesError,
  type UserPreferenceValues,
} from "@stargeist/domain";
import { screen, type BrowserWindowConstructorOptions, type Rectangle } from "electron";
import { Cause, Clock, Deferred, Effect, Fiber, Layer, Logger, References } from "effect";
import { TestClock } from "effect/testing";
import { beforeEach, expect, it, onTestFinished, vi } from "vite-plus/test";
import { Backend } from "../backend";
import { WindowsModule } from "./index";

const native = vi.hoisted(() => ({
  createWindow: vi.fn<(options: BrowserWindowConstructorOptions) => NativeWindow>(),
  primary: vi.fn(),
  matching: vi.fn(),
  load: vi.fn<() => Promise<void>>(),
}));

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    BrowserWindow: vi.fn(function (options: BrowserWindowConstructorOptions) {
      return native.createWindow(options);
    }),
    app: { getAppPath: () => "/stargeist" },
    screen: Object.assign(new EventEmitter(), {
      getPrimaryDisplay: native.primary,
      getDisplayMatching: native.matching,
    }),
  };
});

vi.mock("../backend", async () => {
  const { Context } = await import("effect");
  return { Backend: Context.Service("test/window/Backend") };
});

type WindowState = NonNullable<UserPreferenceValues["window"]>;
const saved: WindowState = {
  bounds: { x: 100, y: 80, width: 1000, height: 700 },
  maximized: false,
  fullScreen: false,
};
const area = { x: 0, y: 30, width: 1600, height: 970 };

class NativeWindow extends EventEmitter {
  bounds: Rectangle;
  maximized = false;
  fullScreen = false;
  minimized = false;
  destroyed = false;
  webContents = Object.assign(new EventEmitter(), {
    setWindowOpenHandler: vi.fn(),
    getURL: () => "about:blank",
    session: {
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
    },
  });
  loadFile = native.load;
  loadURL = native.load;
  shown = Deferred.makeUnsafe<void>();
  show = vi.fn(() => Effect.runSync(Deferred.succeed(this.shown, undefined)));
  isDestroyed = () => this.destroyed;
  isMaximized = () => this.maximized;
  isFullScreen = () => this.fullScreen;
  isMinimized = () => this.minimized;
  getNormalBounds = () => {
    if (this.destroyed) throw new Error("Window is destroyed");
    return { ...this.bounds };
  };
  setMinimumSize = vi.fn();
  setBounds = vi.fn((bounds: Rectangle) => {
    this.bounds = bounds;
    this.emit("resize");
    this.emit("move");
  });
  maximize = vi.fn(() => {
    this.maximized = true;
    this.emit("maximize");
  });
  setFullScreen = vi.fn((_value: boolean) => {});
  destroy = vi.fn(() => {
    this.destroyed = true;
    this.emit("closed");
  });

  constructor(readonly options: BrowserWindowConstructorOptions) {
    super();
    this.bounds = {
      x: options.x!,
      y: options.y!,
      width: options.width!,
      height: options.height!,
    };
  }

  close() {
    this.emit("close");
    this.destroy();
  }
}

const wait = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.timeout("3 seconds")));

function fixture(initial: UserPreferenceValues["window"] = saved) {
  let value = initial;
  const windows: NativeWindow[] = [];
  const created = Deferred.makeUnsafe<NativeWindow>();
  const clock = Deferred.makeUnsafe<TestClock.TestClock>();
  const operations: unknown[] = [];
  const write = vi.fn(
    (next: UserPreferenceValues["window"]): Effect.Effect<void, UserPreferencesError> =>
      Effect.sync(() => {
        value = next;
      }),
  );
  const read = vi.fn((): Effect.Effect<UserPreferenceValues["window"], UserPreferencesError> =>
    Effect.sync(() => value),
  );
  const preferences: UserPreferences["Service"] = {
    get: read,
    set: (_key, next) => write(next),
  };
  native.createWindow.mockImplementation((options) => {
    const window = new NativeWindow(options);
    windows.push(window);
    Effect.runSync(Deferred.succeed(created, window));
    return window;
  });
  const application = Application.define({
    modules: { windows: WindowsModule },
    provide: Layer.merge(
      Layer.succeed(Backend, { failure: Effect.never, connect: () => Effect.void }),
      Layer.succeed(UserPreferences, preferences),
    ),
  });
  const logger = Logger.make(({ fiber }) => {
    operations.push(fiber.getRef(References.CurrentLogAnnotations).operation);
  });
  const open = () => {
    const fiber = Effect.runFork(
      Effect.gen(function* () {
        const timer = yield* TestClock.make();
        yield* Deferred.succeed(clock, timer);
        const desktop = yield* application.make;
        yield* desktop.windows.open.pipe(Effect.provideService(Clock.Clock, timer));
      }).pipe(Effect.scoped, Effect.provide(Logger.layer([logger]))),
    );
    onTestFinished(() => Effect.runPromise(Fiber.interrupt(fiber)));
    return fiber;
  };
  const advance = (millis: number) =>
    wait(Deferred.await(clock).pipe(Effect.flatMap((clock) => clock.adjust(millis))));
  return { open, created, windows, read, write, value: () => value, operations, advance };
}

beforeEach(() => {
  vi.clearAllMocks();
  native.primary.mockReturnValue({ workArea: area });
  native.matching.mockReturnValue({ workArea: area });
  native.load.mockResolvedValue(undefined);
  vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", undefined);
  vi.stubGlobal("MAIN_WINDOW_VITE_NAME", "main_window");
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
});

it("centers the first window, persists normal bounds on close, and restores them when reopened", async () => {
  const runtime = fixture(null);
  const first = runtime.open();
  const window = await wait(Deferred.await(runtime.created));
  await wait(Deferred.await(window.shown));
  expect(window.options).toMatchObject({ x: 250, y: 135, width: 1100, height: 760 });
  window.bounds = saved.bounds;
  window.emit("move");
  window.close();
  await wait(Fiber.join(first));
  expect(runtime.value()).toEqual(saved);
  expect(runtime.write).toHaveBeenCalledOnce();
  expect(window.eventNames()).toEqual([]);
  expect(screen.eventNames()).toEqual([]);

  const second = runtime.open();
  const reopened = runtime.windows[1]!;
  await wait(Deferred.await(reopened.shown));
  expect(reopened.options).toMatchObject(saved.bounds);
  reopened.close();
  await wait(Fiber.join(second));
  expect(runtime.write).toHaveBeenCalledOnce();
});

it.each([
  {
    name: "negative coordinates on a second display",
    bounds: { x: -1500, y: 80, width: 1000, height: 700 },
    workArea: { x: -1600, y: 30, width: 1600, height: 970 },
    expected: { x: -1500, y: 80, width: 1000, height: 700 },
  },
  {
    name: "disconnected display",
    bounds: { x: -1500, y: 80, width: 1000, height: 700 },
    workArea: area,
    expected: { x: 0, y: 80, width: 1000, height: 700 },
  },
  {
    name: "smaller work area after scaling",
    bounds: saved.bounds,
    workArea: { x: 0, y: 40, width: 800, height: 560 },
    expected: { x: 0, y: 40, width: 800, height: 560 },
  },
  {
    name: "window below minimum size",
    bounds: { x: 1550, y: 990, width: 100, height: 100 },
    workArea: area,
    expected: { x: 1240, y: 580, width: 360, height: 420 },
  },
])("fits saved bounds to the $name", async ({ bounds, workArea, expected }) => {
  native.matching.mockReturnValue({ workArea });
  const runtime = fixture({ ...saved, bounds });
  const fiber = runtime.open();
  const window = await wait(Deferred.await(runtime.created));
  await wait(Deferred.await(window.shown));
  expect(native.matching).toHaveBeenCalledWith(bounds);
  expect(window.options).toMatchObject(expected);
  window.close();
  await wait(Fiber.join(fiber));
  expect(runtime.value()?.bounds).toEqual(expected);
});

it("restores maximized and asynchronous fullscreen state without saving transition dimensions", async () => {
  const state = { ...saved, maximized: true, fullScreen: true };
  const runtime = fixture(state);
  const fiber = runtime.open();
  const window = await wait(Deferred.await(runtime.created));
  await wait(Deferred.await(window.shown));
  expect(window.maximize).toHaveBeenCalledOnce();
  expect(window.setFullScreen).toHaveBeenCalledExactlyOnceWith(true);
  window.maximized = false;
  window.emit("resize");
  window.fullScreen = true;
  window.emit("enter-full-screen");
  window.minimized = true;
  window.emit("resize");
  window.close();
  await wait(Fiber.join(fiber));
  expect(runtime.value()).toEqual(state);
  expect(runtime.write).not.toHaveBeenCalled();
});

it("coalesces move and resize events and flushes the latest bounds before shutdown destroys the window", async () => {
  const runtime = fixture();
  const fiber = runtime.open();
  const window = await Effect.runPromise(Deferred.await(runtime.created));
  await Effect.runPromise(Deferred.await(window.shown));
  for (let x = 110; x <= 150; x += 10) {
    window.bounds = { ...saved.bounds, x };
    window.emit("move");
    window.emit("resize");
  }
  await runtime.advance(249);
  expect(runtime.write).not.toHaveBeenCalled();
  await runtime.advance(1);
  expect(runtime.write).toHaveBeenCalledExactlyOnceWith({
    ...saved,
    bounds: { ...saved.bounds, x: 150 },
  });
  window.bounds = { ...saved.bounds, x: 170 };
  window.emit("move");
  await Effect.runPromise(Fiber.interrupt(fiber));
  expect(runtime.value()?.bounds.x).toBe(170);
  expect(runtime.write).toHaveBeenCalledTimes(2);
  expect(window.destroy).toHaveBeenCalledOnce();
  expect(window.eventNames()).toEqual([]);
  expect(screen.eventNames()).toEqual([]);
  await runtime.advance(1000);
  expect(runtime.write).toHaveBeenCalledTimes(2);
});

it("logs a failed save, preserves persisted state, and retries the latest state on close", async () => {
  const runtime = fixture();
  runtime.write.mockImplementationOnce(() =>
    Effect.fail(
      new UserPreferencesError({
        operation: "write",
        message: "Unavailable",
        cause: new Error("Disk unavailable"),
      }),
    ),
  );
  const fiber = runtime.open();
  const window = await Effect.runPromise(Deferred.await(runtime.created));
  await Effect.runPromise(Deferred.await(window.shown));
  window.bounds = { ...saved.bounds, x: 180 };
  window.emit("move");
  await runtime.advance(250);
  expect(runtime.value()).toEqual(saved);
  expect(runtime.operations).toContain("window.preferences.save");
  expect(fiber.pollUnsafe()).toBeUndefined();
  window.close();
  await Effect.runPromise(Fiber.join(fiber));
  expect(runtime.value()?.bounds.x).toBe(180);
});

it("fits a window after a display change, deferring placement until a maximized window is restored", async () => {
  const runtime = fixture();
  const fiber = runtime.open();
  const window = await wait(Deferred.await(runtime.created));
  await wait(Deferred.await(window.shown));
  window.maximize();
  native.matching.mockReturnValue({ workArea: { x: 0, y: 40, width: 800, height: 560 } });
  screen.emit("display-removed", {}, {});
  expect(window.setBounds).not.toHaveBeenCalled();
  window.maximized = false;
  window.emit("unmaximize");
  expect(window.bounds).toEqual({ x: 0, y: 40, width: 800, height: 560 });
  window.close();
  await wait(Fiber.join(fiber));
  expect(runtime.value()).toEqual({ ...saved, bounds: window.bounds });
});

it("persists leaving fullscreen and maximizing again as distinct user choices", async () => {
  const runtime = fixture({ ...saved, fullScreen: true });
  const fiber = runtime.open();
  const window = await wait(Deferred.await(runtime.created));
  await wait(Deferred.await(window.shown));
  window.fullScreen = true;
  window.emit("enter-full-screen");
  window.fullScreen = false;
  window.emit("leave-full-screen");
  window.bounds = { ...saved.bounds, width: 1200 };
  window.emit("resize");
  window.maximize();
  window.close();
  await wait(Fiber.join(fiber));
  expect(runtime.value()).toEqual({ ...saved, bounds: window.bounds, maximized: true });
});

it("finishes an in-flight write before flushing a newer state on close", async () => {
  const runtime = fixture();
  const started = Deferred.makeUnsafe<void>();
  const finish = Deferred.makeUnsafe<void>();
  const write = runtime.write.getMockImplementation()!;
  runtime.write.mockImplementationOnce((value) =>
    Deferred.succeed(started, undefined).pipe(
      Effect.andThen(Deferred.await(finish)),
      Effect.andThen(write(value)),
    ),
  );
  onTestFinished(() => {
    Effect.runSync(Deferred.succeed(finish, undefined));
  });
  const fiber = runtime.open();
  const window = await wait(Deferred.await(runtime.created));
  await wait(Deferred.await(window.shown));
  window.bounds = { ...saved.bounds, x: 150 };
  window.emit("move");
  await runtime.advance(250);
  await wait(Deferred.await(started));
  window.bounds = { ...saved.bounds, x: 190 };
  window.close();
  expect(fiber.pollUnsafe()).toBeUndefined();
  Effect.runSync(Deferred.succeed(finish, undefined));
  await wait(Fiber.join(fiber));
  expect(runtime.value()?.bounds.x).toBe(190);
  expect(runtime.write.mock.calls.map(([value]) => value?.bounds.x)).toEqual([150, 190]);
});

it("does not open a window when saved preferences cannot be read", async () => {
  const runtime = fixture();
  const failure = new UserPreferencesError({
    operation: "read",
    message: "Unavailable",
    cause: new Error("Invalid file"),
  });
  runtime.read.mockReturnValueOnce(Effect.fail(failure));
  const exit = await wait(Fiber.await(runtime.open()));
  expect(exit._tag).toBe("Failure");
  if (exit._tag === "Failure") expect(Cause.squash(exit.cause)).toBe(failure);
  expect(native.createWindow).not.toHaveBeenCalled();
  expect(runtime.write).not.toHaveBeenCalled();
});

it("preserves saved preferences and releases the hidden window if renderer loading fails", async () => {
  native.load.mockRejectedValueOnce(new Error("Renderer missing"));
  const runtime = fixture();
  const fiber = runtime.open();
  const window = await wait(Deferred.await(runtime.created));
  const exit = await wait(Fiber.await(fiber));
  expect(exit._tag).toBe("Failure");
  if (exit._tag === "Failure")
    expect(Cause.squash(exit.cause)).toMatchObject({ _tag: "WindowLoadError" });
  expect(window.show).not.toHaveBeenCalled();
  expect(window.destroy).toHaveBeenCalledOnce();
  expect(runtime.write).not.toHaveBeenCalled();
  expect(window.eventNames()).toEqual([]);
  expect(screen.eventNames()).toEqual([]);
});

it("destroys an acquired window if native configuration fails", async () => {
  const runtime = fixture();
  const create = native.createWindow.getMockImplementation()!;
  const failure = new Error("Native configuration failed");
  native.createWindow.mockImplementationOnce((options) => {
    const window = create(options);
    window.webContents.setWindowOpenHandler.mockImplementationOnce(() => {
      throw failure;
    });
    return window;
  });

  const fiber = runtime.open();
  const window = await wait(Deferred.await(runtime.created));
  const exit = await wait(Fiber.await(fiber));
  expect(exit._tag).toBe("Failure");
  if (exit._tag === "Failure") expect(Cause.squash(exit.cause)).toBe(failure);
  expect(window.destroy).toHaveBeenCalledOnce();
  expect(window.show).not.toHaveBeenCalled();
  expect(runtime.write).not.toHaveBeenCalled();
});
