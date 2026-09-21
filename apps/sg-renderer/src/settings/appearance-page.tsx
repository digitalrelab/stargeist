import { typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

export function AppearancePage() {
  return (
    <main {...stylex.props(styles.page)}>
      <h1 {...stylex.props(typography.heading)}>Appearance</h1>
      <p {...stylex.props(styles.placeholder)}>No appearance settings yet.</p>
    </main>
  );
}

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: space[4],
    padding: { default: space[6], "@media (max-width: 480px)": space[4] },
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
  },
  placeholder: { color: colors.textMuted },
});
