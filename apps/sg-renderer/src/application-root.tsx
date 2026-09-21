import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Button } from "@stargeist/ui/button";
import { colors } from "@stargeist/ui/colors.stylex";
import { space } from "@stargeist/ui/tokens.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import { RouterProvider } from "@tanstack/react-router";
import type { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useMemo } from "react";
import { failureMessage, type ClientUnavailableError } from "#src/rpc/index.ts";
import type { RendererServices } from "./application";
import { createAppRouter } from "./router";

export function ApplicationRoot({
  startup,
}: {
  startup: Atom.Atom<AsyncResult.AsyncResult<RendererServices, ClientUnavailableError>>;
}) {
  const result = useAtomValue(startup);
  const retry = useAtomRefresh(startup);

  if (result._tag === "Success") return <ReadyApplication application={result.value} />;

  return (
    <main {...stylex.props(styles.startup)}>
      <h1 {...stylex.props(typography.heading)}>Stargeist</h1>
      {result._tag === "Failure" && !result.waiting ? (
        <>
          <p role="alert">{failureMessage(result.cause)}</p>
          <Button onClick={retry}>Try again</Button>
        </>
      ) : (
        <p role="status">Starting Stargeist…</p>
      )}
    </main>
  );
}

function ReadyApplication({ application }: { application: RendererServices }) {
  const router = useMemo(() => createAppRouter(application), [application]);
  return <RouterProvider router={router} />;
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
