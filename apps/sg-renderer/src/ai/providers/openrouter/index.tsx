import { IconBadge } from "@stargeist/ui";
import * as stylex from "@stylexjs/stylex";
import glyph from "./glyph-dark.svg";

export function OpenRouterBadge() {
  return (
    <IconBadge aria-hidden="true">
      <img src={glyph} alt="" draggable={false} {...stylex.props(styles.glyph)} />
    </IconBadge>
  );
}

const styles = stylex.create({
  glyph: { display: "block", inlineSize: 22, blockSize: "auto" },
});
