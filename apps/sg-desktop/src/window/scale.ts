import { InterfaceScale, UserPreferences } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { BrowserWindow, dialog, type WebContents } from "electron";
import { Cause, Effect, FiberHandle, Stream } from "effect";

export type ScaleCommand = "increase" | "decrease" | "reset";
export type RunScaleCommand = (command: ScaleCommand) => void;

export const changeInterfaceScale = Effect.fnUntraced(function* (command: ScaleCommand) {
  const preferences = yield* UserPreferences;
  const current = yield* preferences.get("interfaceScale");
  let next: InterfaceScale = 1;
  if (command === "increase")
    next = InterfaceScale.literals.find((scale) => scale > current) ?? current;
  if (command === "decrease")
    next = InterfaceScale.literals.findLast((scale) => scale < current) ?? current;
  if (next !== current) yield* preferences.set("interfaceScale", next);
});

export const scaleCommands = Effect.gen(function* () {
  const run = yield* FiberHandle.makeRuntime<UserPreferences>();
  return (command: ScaleCommand) =>
    run(
      changeInterfaceScale(command).pipe(
        Effect.catch((error) =>
          reportFailure("window.scale.save", Cause.fail(error)).pipe(
            Effect.andThen(
              Effect.promise((signal) => {
                const options = {
                  type: "error" as const,
                  message: "Could not change interface scale",
                  detail: error.message,
                  buttons: ["OK"],
                  signal,
                };
                const window = BrowserWindow.getFocusedWindow();
                if (window) return dialog.showMessageBox(window, options);
                return dialog.showMessageBox(options);
              }),
            ),
          ),
        ),
        Effect.catchCause((cause) => reportFailure("window.scale.command", cause)),
      ),
      { onlyIfMissing: true },
    );
});

export const withInterfaceScale = Effect.fnUntraced(function* <A, E, R>(
  contents: WebContents,
  changeScale: RunScaleCommand,
  use: Effect.Effect<A, E, R>,
) {
  const preferences = yield* UserPreferences;
  const onZoom = (_event: Electron.Event, direction: "in" | "out") => {
    if (direction === "in") changeScale("increase");
    else changeScale("decrease");
  };
  yield* Effect.acquireRelease(
    Effect.sync(() => contents.on("zoom-changed", onZoom)),
    () => Effect.sync(() => contents.removeListener("zoom-changed", onZoom)),
  );
  const current = yield* preferences.get("interfaceScale");
  yield* Effect.sync(() => contents.setZoomFactor(current));
  return yield* use.pipe(
    Effect.raceFirst(
      preferences
        .watch("interfaceScale")
        .pipe(Stream.runForEach((scale) => Effect.sync(() => contents.setZoomFactor(scale)))),
    ),
  );
});
