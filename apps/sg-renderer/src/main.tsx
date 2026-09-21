import { RegistryContext } from "@effect/atom-react";
import { reportFailure } from "@stargeist/std/errors";
import { typography } from "@stargeist/ui";
import { colors } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Cause, Effect } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApplicationRoot } from "./application-root";
import { createRendererApplication } from "./application";
import { desktopConnectionLayer } from "./desktop/connection";
import { createAppRouter } from "./router";
import "@stargeist/ui/reset.css";
import "./reset.css";

const styles = stylex.create({
  document: {
    backgroundColor: colors.canvas,
    color: colors.text,
    colorScheme: "dark",
  },
});

const documentClassName = stylex.props(typography.body, styles.document).className;

if (documentClassName) {
  document.documentElement.classList.add(...documentClassName.split(" "));
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("The application root is missing");
}

const registry = AtomRegistry.make();
const startup = Atom.make(
  createRendererApplication(desktopConnectionLayer).make.pipe(
    Effect.flatMap((application) =>
      Effect.acquireRelease(
        Effect.sync(() => createAppRouter(application)),
        (router) => Effect.sync(() => router.history.destroy()),
      ),
    ),
    Effect.onError((cause) => reportFailure("renderer.startup", cause)),
  ),
).pipe(Atom.keepAlive);
const reactRoot = createRoot(root, {
  onUncaughtError: (error) => Effect.runSync(reportFailure("renderer.render", Cause.die(error))),
  onRecoverableError: (error) =>
    Effect.runSync(reportFailure("renderer.recover", Cause.die(error))),
});

reactRoot.render(
  <StrictMode>
    <RegistryContext value={registry}>
      <ApplicationRoot startup={startup} />
    </RegistryContext>
  </StrictMode>,
);

const dispose = () => {
  reactRoot.unmount();
  registry.dispose();
};

window.addEventListener("pagehide", dispose, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("pagehide", dispose);
    dispose();
  });
}
