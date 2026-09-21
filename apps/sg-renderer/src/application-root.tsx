import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Button, typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { RouterProvider } from "@tanstack/react-router";
import type { AsyncResult, Atom } from "effect/unstable/reactivity";
import { failureMessage, type ClientUnavailableError } from "#src/client/index.ts";
import type { createAppRouter } from "./router";

export function ApplicationRoot({
  startup,
}: {
  startup: Atom.Atom<
    AsyncResult.AsyncResult<ReturnType<typeof createAppRouter>, ClientUnavailableError>
  >;
}) {
  const result = useAtomValue(startup);
  const retry = useAtomRefresh(startup);

  if (result._tag === "Success") return <RouterProvider router={result.value} />;

  let content = <p role="status">Starting Stargeist…</p>;

  if (result._tag === "Failure" && !result.waiting) {
    content = (
      <>
        <p role="alert">{failureMessage(result.cause)}</p>
        <Button onClick={retry}>Try again</Button>
      </>
    );
  }

  return (
    <main {...stylex.props(styles.startup)}>
      <h1 {...stylex.props(typography.heading)}>Stargeist</h1>
      {content}
    </main>
  );
}

const styles = stylex.create({
  startup: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100dvh",
    padding: space[8],
    gap: space[4],
    color: colors.textMuted,
  },
});
