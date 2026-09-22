import { reportFailure } from "@stargeist/std/errors";
import { Effect } from "effect";
import type { AtomRegistry } from "effect/unstable/reactivity";

export const startRenderer = Effect.fnUntraced(
  function* (registry: AtomRegistry.AtomRegistry) {
    const [{ createRendererApplication }, { desktopConnectionLayer }, { createAppRouter }] =
      yield* Effect.promise(() =>
        Promise.all([import("./application"), import("./desktop/connection"), import("./router")]),
      );
    const application = yield* createRendererApplication(desktopConnectionLayer).make;

    return yield* Effect.acquireRelease(
      Effect.sync(() => createAppRouter(application, registry)),
      (router) => Effect.sync(() => router.history.destroy()),
    );
  },
  Effect.onError((cause) => reportFailure("renderer.startup", cause)),
);
