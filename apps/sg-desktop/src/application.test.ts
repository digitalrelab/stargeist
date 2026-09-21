import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import { Effect } from "effect";
import { expect, it, onTestFinished, vi } from "vite-plus/test";
import { DesktopApplication } from "./application";
import { runDesktop } from "./lifecycle";

const native = vi.hoisted(() => ({
  getPath: vi.fn<() => string>(),
  open: vi.fn<() => void>(),
  startBackend: vi.fn(),
  stopBackend: vi.fn(),
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

vi.mock("./backend", async () => {
  const { Context, Effect, Layer } = await import("effect");
  const { AIProviderConnections } = await import("@stargeist/domain/ai");
  class Backend extends Context.Service<Backend, { readonly failure: Effect.Effect<never> }>()(
    "test/Backend",
  ) {}
  const backendLayer = Layer.effect(
    Backend,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const connections = yield* AIProviderConnections;
        native.startBackend(connections);
        return { failure: Effect.never };
      }),
      () =>
        Effect.sync(() => {
          native.stopBackend();
        }),
    ),
  );
  return { Backend, backendLayer };
});

vi.mock("./window", async () => {
  const { Module } = await import("@stargeist/application");
  const { Context, Effect, Layer } = await import("effect");
  class Windows extends Context.Service<Windows, { readonly open: Effect.Effect<void> }>()(
    "test/Windows",
  ) {}
  return {
    WindowsModule: Module.define({
      exports: Windows,
      layer: Layer.succeed(Windows, { open: Effect.sync(() => native.open()) }),
    }),
  };
});

it.each([true, false])(
  "gates desktop window startup on valid user preferences: %s",
  async (valid) => {
    vi.clearAllMocks();
    app.removeAllListeners();
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

    await Effect.runPromise(runDesktop(DesktopApplication).pipe(Effect.timeout("3 seconds")));

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

it("shares provider connections with the backend within each application lifetime", async () => {
  vi.clearAllMocks();
  const profile = await mkdtemp(join(tmpdir(), "stargeist-connections-application-"));
  onTestFinished(() => rm(profile, { recursive: true, force: true }));
  native.getPath.mockReturnValue(profile);

  const first = await Effect.runPromise(
    DesktopApplication.make.pipe(
      Effect.map((services) => {
        expect(services.aiProviderConnections).toBe(native.startBackend.mock.calls[0]?.[0]);
        return services.aiProviderConnections;
      }),
      Effect.scoped,
    ),
  );
  const second = await Effect.runPromise(
    DesktopApplication.make.pipe(
      Effect.map((services) => {
        expect(services.aiProviderConnections).toBe(native.startBackend.mock.calls[1]?.[0]);
        return services.aiProviderConnections;
      }),
      Effect.scoped,
    ),
  );

  expect(second).not.toBe(first);
  expect(native.stopBackend).toHaveBeenCalledTimes(2);
  expect(native.encryptionAvailable).not.toHaveBeenCalled();
});
