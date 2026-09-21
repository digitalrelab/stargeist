import { space } from "@stargeist/ui/tokens.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({ component: SettingsPage });

function SettingsPage() {
  return (
    <main {...stylex.props(styles.page)}>
      <h1 {...stylex.props(typography.heading)}>General</h1>
    </main>
  );
}

const styles = stylex.create({
  page: { padding: space[6], minWidth: 0, minHeight: 0, overflowY: "auto" },
});
