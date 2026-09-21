import { Button, typography } from "@stargeist/ui";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";

export function RouteError() {
  return (
    <main {...stylex.props(styles.error)}>
      <h1 {...stylex.props(typography.heading)}>This page could not be opened.</h1>
      <Button.Link render={<Link to="/" />}>Back to home</Button.Link>
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
