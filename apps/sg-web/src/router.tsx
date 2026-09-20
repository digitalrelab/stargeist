import { reportFailure } from "@stargeist/std/errors";
import { Button } from "@stargeist/ui/button";
import { colors } from "@stargeist/ui/colors.stylex";
import { space } from "@stargeist/ui/tokens.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import {
  createBrowserHistory,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import { Cause, Effect } from "effect";
import { useState } from "react";

function RouteError() {
  const router = useRouter();

  return (
    <main {...stylex.props(styles.screen)}>
      <h1 {...stylex.props(typography.heading)}>Something went wrong.</h1>
      <Button onClick={() => void router.invalidate()}>Try again</Button>
    </main>
  );
}

const rootRoute = createRootRoute({
  component: Outlet,
  errorComponent: RouteError,
  onCatch: (error) => Effect.runSync(reportFailure("web.route", Cause.die(error))),
  notFoundComponent: () => <main {...stylex.props(styles.screen)}>Page not found.</main>,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: ({ abortController }) =>
    Effect.runPromise(Effect.succeed("Hello, world!"), { signal: abortController.signal }),
  component: Home,
});

function Home() {
  const greeting = homeRoute.useLoaderData();
  const [greeted, setGreeted] = useState(false);

  return (
    <main {...stylex.props(styles.screen)}>
      <p {...stylex.props(typography.label, styles.name)}>Stargeist</p>
      <h1 {...stylex.props(typography.display)} aria-live="polite">
        {greeted ? "Hello again!" : greeting}
      </h1>
      <Button onClick={() => setGreeted((value) => !value)}>
        {greeted ? "Start over" : "Say hello"}
      </Button>
    </main>
  );
}

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute]),
  history: window.location.protocol === "file:" ? createHashHistory() : createBrowserHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const styles = stylex.create({
  screen: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: space[6],
    justifyContent: "center",
    minHeight: "100dvh",
    padding: space[8],
    textAlign: "center",
  },
  name: { color: colors.textMuted },
});
