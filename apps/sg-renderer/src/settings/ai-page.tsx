import { typography } from "@stargeist/ui";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Providers } from "#src/ai/index.ts";

export function AIPage() {
  return (
    <main {...stylex.props(styles.page)}>
      <h1 {...stylex.props(typography.heading)}>AI</h1>
      <Providers />
    </main>
  );
}

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: space[8],
    padding: { default: space[6], "@media (max-width: 480px)": space[4] },
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
  },
});
