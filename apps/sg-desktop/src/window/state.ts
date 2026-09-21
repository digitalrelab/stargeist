import { UserPreferences, UserPreferenceValues } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { screen, type BrowserWindow } from "electron";
import { Effect, Queue, Schema, Stream } from "effect";
import { windowPlacement } from "./placement";

const sameState = Schema.toEquivalence(UserPreferenceValues.fields.window);
type WindowState = NonNullable<UserPreferenceValues["window"]>;

export const trackWindowState = Effect.fnUntraced(function* (
  window: BrowserWindow,
  initial: WindowState,
  saved: UserPreferenceValues["window"],
) {
  const preferences = yield* UserPreferences;
  const changes = yield* Queue.sliding<void>(1);
  let current = initial;
  let persisted = saved;
  let placementPending = false;

  const capture = () => {
    if (window.isDestroyed() || window.isMinimized()) return;
    let maximized = current.maximized;
    if (!current.fullScreen && !window.isFullScreen()) maximized = window.isMaximized();
    current = { bounds: window.getNormalBounds(), maximized, fullScreen: current.fullScreen };
  };

  const changed = () => {
    capture();
    Queue.offerUnsafe(changes, undefined);
  };

  const place = () => {
    if (window.isDestroyed()) return;
    placementPending = true;
    if (window.isMinimized() || window.isMaximized() || window.isFullScreen()) return;

    const { bounds, minWidth, minHeight } = windowPlacement(window.getNormalBounds());
    placementPending = false;
    window.setMinimumSize(minWidth, minHeight);
    window.setBounds(bounds);
    changed();
  };

  const restored = () => {
    if (placementPending) place();
    changed();
  };
  const enterFullScreen = () => {
    current = { ...current, fullScreen: true };
    changed();
  };
  const leaveFullScreen = () => {
    current = { ...current, fullScreen: false };
    restored();
  };

  const save = Effect.gen(function* () {
    const value = current;
    if (sameState(value, persisted)) return;
    yield* preferences.set("window", value);
    persisted = value;
  }).pipe(Effect.catchCause((cause) => reportFailure("window.preferences.save", cause)));

  const listeners = (method: "on" | "removeListener") => {
    window[method]("move", changed);
    window[method]("resize", changed);
    window[method]("maximize", changed);
    window[method]("unmaximize", restored);
    window[method]("restore", restored);
    window[method]("enter-full-screen", enterFullScreen);
    window[method]("leave-full-screen", leaveFullScreen);
    window[method]("close", capture);
    screen[method]("display-removed", place);
    screen[method]("display-metrics-changed", place);
  };

  yield* Effect.acquireRelease(
    Effect.sync(() => listeners("on")),
    () =>
      Effect.sync(() => {
        listeners("removeListener");
        capture();
      }).pipe(Effect.andThen(save)),
  );

  yield* Stream.fromQueue(changes).pipe(
    Stream.debounce("250 millis"),
    Stream.runForEach(() => save.pipe(Effect.uninterruptible)),
    Effect.forkScoped,
  );
});
