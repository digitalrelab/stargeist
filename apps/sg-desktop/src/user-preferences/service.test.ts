import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Fiber, Queue, Stream } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { pathsLayer } from "../storage";
import { UserPreferences } from "@stargeist/domain";
import { userPreferencesLayer } from "./index";
import { Layer } from "effect";

const window = {
  bounds: { x: -1200, y: 30, width: 1100, height: 760 },
  maximized: false,
  fullScreen: false,
};

it("publishes the current scale and successful changes, preserves other preferences, and restores scale on reopen", async () => {
  const { open } = await fixture();
  const preferences = await open();
  await Effect.runPromise(
    Effect.gen(function* () {
      const snapshots = yield* Queue.unbounded<number>();
      const watcher = yield* preferences.watch("interfaceScale").pipe(
        Stream.runForEach((scale) => Queue.offer(snapshots, scale)),
        Effect.forkScoped,
      );
      expect(yield* Queue.take(snapshots)).toBe(1);
      yield* preferences.set("window", window);
      yield* preferences.set("interfaceScale", 1.5);
      expect(yield* Queue.take(snapshots)).toBe(1.5);
      expect(yield* preferences.get("window")).toEqual(window);
      yield* preferences.set("interfaceScale", 1.5);
      yield* preferences.set("interfaceScale", 1);
      expect(yield* Queue.take(snapshots)).toBe(1);
      yield* Fiber.interrupt(watcher);
      yield* preferences.set("interfaceScale", 1.75);
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
  expect(await Effect.runPromise((await open()).get("interfaceScale"))).toBe(1.75);
});

async function fixture() {
  const profile = await mkdtemp(join(tmpdir(), "stargeist-preferences-test-"));
  onTestFinished(() => rm(profile, { recursive: true, force: true }));
  const filename = join(profile, "data", "user-preferences.json");
  const open = () =>
    Effect.runPromise(
      UserPreferences.pipe(
        Effect.provide(userPreferencesLayer.pipe(Layer.provide(pathsLayer(profile)))),
      ),
    );
  return { profile, filename, open };
}

it("defaults to no saved window, persists values across reopening, and permits clearing them", async () => {
  const { filename, open } = await fixture();
  const preferences = await open();
  expect(await Effect.runPromise(preferences.get("window"))).toBeNull();
  await Effect.runPromise(preferences.set("window", window));
  expect(JSON.parse(await readFile(filename, "utf8"))).toEqual({ window, interfaceScale: 1 });

  const reopened = await open();
  expect(await Effect.runPromise(reopened.get("window"))).toEqual(window);
  await Effect.runPromise(reopened.set("window", null));
  expect(await Effect.runPromise((await open()).get("window"))).toBeNull();
});

it.each([
  ["malformed JSON", "{"],
  [
    "invalid dimensions",
    JSON.stringify({ window: { ...window, bounds: { ...window.bounds, width: 0 } } }),
  ],
  ["invalid document", "[]"],
  ["unrecognized preference", '{"unexpected":true}'],
  ["unsupported scale", '{"interfaceScale":3}'],
])("rejects %s on startup without overwriting the file", async (_description, contents) => {
  const { profile, filename, open } = await fixture();
  await mkdir(join(profile, "data"));
  await writeFile(filename, contents);
  await expect(open()).rejects.toMatchObject({
    _tag: "UserPreferencesError",
    operation: "open",
  });
  expect(await readFile(filename, "utf8")).toBe(contents);
});

it("validates writes without changing previously saved values", async () => {
  const { filename, open } = await fixture();
  const preferences = await open();
  await Effect.runPromise(preferences.set("window", window));
  const saved = await readFile(filename, "utf8");
  const error = await Effect.runPromise(
    preferences
      .set("window", { ...window, bounds: { ...window.bounds, height: -1 } })
      .pipe(Effect.flip),
  );
  expect(error).toMatchObject({ _tag: "UserPreferencesError", operation: "write" });
  expect(await readFile(filename, "utf8")).toBe(saved);
});

it("reports corruption introduced after opening on both reads and writes", async () => {
  const { filename, open } = await fixture();
  const preferences = await open();
  await writeFile(filename, "broken");
  expect(await Effect.runPromise(preferences.get("window").pipe(Effect.flip))).toMatchObject({
    operation: "read",
  });
  expect(
    await Effect.runPromise(preferences.set("window", window).pipe(Effect.flip)),
  ).toMatchObject({ operation: "write" });
  expect(await readFile(filename, "utf8")).toBe("broken");
});

it("reports an inaccessible storage location during initialization", async () => {
  const { profile, open } = await fixture();
  await writeFile(join(profile, "data"), "not a directory");
  await expect(open()).rejects.toMatchObject({ _tag: "UserPreferencesError", operation: "open" });
});

it("reports unavailable storage on writes and allows retry after recovery", async () => {
  const { profile, open } = await fixture();
  const preferences = await open();
  await Effect.runPromise(preferences.set("window", window));
  const data = join(profile, "data");
  const backup = join(profile, "saved-data");
  await rename(data, backup);
  await writeFile(data, "not a directory");

  const error = await Effect.runPromise(preferences.set("window", null).pipe(Effect.flip));
  expect(error).toMatchObject({ _tag: "UserPreferencesError", operation: "write" });
  expect(JSON.parse(await readFile(join(backup, "user-preferences.json"), "utf8"))).toEqual({
    window,
    interfaceScale: 1,
  });

  await rm(data);
  await rename(backup, data);
  await Effect.runPromise(preferences.set("window", null));
  expect(await Effect.runPromise(preferences.get("window"))).toBeNull();
});
