import { Button } from "@stargeist/ui/button";
import { space } from "@stargeist/ui/tokens.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import { useRouter } from "@tanstack/react-router";

export function RouteError() {
  const router = useRouter();

  return (
    <main {...stylex.props(styles.error)}>
      <h1 {...stylex.props(typography.heading)}>This page could not be opened.</h1>
      <Button onClick={() => void router.navigate({ to: "/" })}>Back to home</Button>
    </main>
  );
}

const styles = stylex.create({
  error: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: space[4],
    padding: space[8],
  },
});
