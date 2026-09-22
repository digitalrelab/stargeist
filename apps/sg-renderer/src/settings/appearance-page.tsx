import { colors } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

export function AppearancePage() {
  return <p {...stylex.props(styles.placeholder)}>No appearance settings yet.</p>;
}

const styles = stylex.create({
  placeholder: { color: colors.textMuted },
});
