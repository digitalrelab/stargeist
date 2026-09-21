import { typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

export function WorkspacesPage() {
  return (
    <main {...stylex.props(styles.page)}>
      <h1 {...stylex.props(typography.heading)}>Your workspaces</h1>
      <p {...stylex.props(styles.description)}>Choose a workspace or create one from a folder.</p>
    </main>
  );
}

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: space[4],
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    padding: { default: space[8], "@media (max-width: 640px)": space[4] },
  },
  description: { color: colors.textMuted },
});
