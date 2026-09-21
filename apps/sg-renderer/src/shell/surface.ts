import { colors, radii } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

export const surface = stylex.create({
  root: {
    minWidth: 0,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
});
