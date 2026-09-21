import { RegistryProvider } from "@effect/atom-react";
import { reportFailure } from "@stargeist/std/errors";
import { colors } from "@stargeist/ui/colors.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import { RouterProvider } from "@tanstack/react-router";
import { Cause, Effect } from "effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router";
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

createRoot(root, {
  onUncaughtError: (error) => Effect.runSync(reportFailure("web.render", Cause.die(error))),
  onRecoverableError: (error) => Effect.runSync(reportFailure("web.recover", Cause.die(error))),
}).render(
  <StrictMode>
    <RegistryProvider>
      <RouterProvider router={router} />
    </RegistryProvider>
  </StrictMode>,
);
