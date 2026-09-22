import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import { Deferred, Effect } from "effect";
import { beforeEach, expect, it, onTestFinished, vi } from "vite-plus/test";
import { desktopProgram } from "./application";
import { runDesktop } from "./lifecycle";

const native = vi.hoisted(() => ({
  getPath: vi.fn<() => string>(),
  open: vi.fn<() => void>(),
  startBackend: vi.fn(),
  stopBackend: vi.fn(),
  failure: vi.fn<() => Effect.Effect<never, Error>>(),
  quit: vi.fn(),
  exit: vi.fn(),
  encryptionAvailable: vi.fn(),
}));

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const app = Object.assign(new EventEmitter(), {
    getPath: native.getPath,
    getVersion: () => "0.0.0",
    whenReady: () => Promise.resolve(),
    isPackaged: true,
    quit: native.quit,
    exit: native.exit,
  });
  const electron = {
    app,
    ipcMain: new EventEmitter(),
    BrowserWindow: { getAllWindows: () => [] },
    safeStorage: { isAsyncEncryptionAvailable: native.encryptionAvailable },
  };
  return { ...electron, default: electron };
});

vi.mock("./backend", async (importOriginal) => {
  const { Effect } = await import("effect");
  const { clientProtocol } = await import("@stargeist/std/rpc");
  const actual = await importOriginal<typeof import("./backend")>();
  return {
    ...actual,
    openBackend: Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => native.startBackend()),
        () =>
          Effect.sync(() => {
            native.stopBackend();
          }),
      );
      const protocol = yield* clientProtocol({
        closed: Effect.never,
        send: () => {},
        close: () => {},
        listen: () => () => {},
      });
      return {
        protocol,
        failure: Effect.suspend(() => native.failure()),
        connect: () => Effect.void,
      };
    }),
  };
});

vi.mock("./window", async (importOriginal) => {
  const { Module } = await import("@stargeist/application");
  const { Context, Effect, Layer } = await import("effect");
  class Windows extends Context.Service<Windows, { readonly open: Effect.Effect<void> }>()(
    "test/Windows",
  ) {}
  const actual = await importOriginal<typeof import("./window")>();
  return {
    ...actual,
    WindowsModule: Module.define({
      exports: Windows,
      layer: Layer.succeed(Windows, { open: Effect.sync(() => native.open()) }),
    }),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  app.removeAllListeners();
  native.failure.mockReturnValue(Effect.never);
});

it.each([true, false])(
  "gates desktop window startup on valid user preferences: %s",
  async (valid) => {
    const profile = await mkdtemp(join(tmpdir(), "stargeist-preferences-startup-"));
    onTestFinished(() => rm(profile, { recursive: true, force: true }));
    await mkdir(join(profile, "data"));
    const filename = join(profile, "data", "user-preferences.json");
    let contents = "{";
    if (valid) contents = "{}";
    await writeFile(filename, contents);
    native.getPath.mockReturnValue(profile);
    native.open.mockImplementation(() => {
      app.emit("before-quit", { preventDefault() {} });
    });

    await Effect.runPromise(runDesktop(desktopProgram).pipe(Effect.timeout("3 seconds")));

    if (valid) {
      expect(native.open).toHaveBeenCalledOnce();
      expect(native.quit).toHaveBeenCalledOnce();
      expect(native.exit).not.toHaveBeenCalled();
    } else {
      expect(native.open).not.toHaveBeenCalled();
      expect(native.quit).not.toHaveBeenCalled();
      expect(native.exit).toHaveBeenCalledExactlyOnceWith(1);
    }
    expect(native.startBackend).toHaveBeenCalledOnce();
    expect(native.stopBackend).toHaveBeenCalledOnce();
    expect(await readFile(filename, "utf8")).toBe(contents);
    expect(app.eventNames()).toEqual([]);
    expect(native.encryptionAvailable).not.toHaveBeenCalled();
  },
);

it("supervises process failure outside the application API and releases hosting before exit", async () => {
  const profile = await mkdtemp(join(tmpdir(), "stargeist-host-failure-"));
  onTestFinished(() => rm(profile, { recursive: true, force: true }));
  native.getPath.mockReturnValue(profile);
  const failure = Effect.runSync(Deferred.make<never, Error>());
  native.failure.mockReturnValue(Deferred.await(failure));
  native.open.mockImplementation(() => {
    Effect.runSync(Deferred.fail(failure, new Error("Backend exited")));
  });
  native.exit.mockImplementation(() => {
    expect(native.stopBackend).toHaveBeenCalledOnce();
    expect(app.eventNames()).toEqual([]);
  });
  await Effect.runPromise(runDesktop(desktopProgram).pipe(Effect.timeout("3 seconds")));
  expect(native.open).toHaveBeenCalledOnce();
  expect(native.exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(native.quit).not.toHaveBeenCalled();
});
