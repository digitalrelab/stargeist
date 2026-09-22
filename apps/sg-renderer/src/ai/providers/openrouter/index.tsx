import * as stylex from "@stylexjs/stylex";
import glyph from "./glyph-dark.svg";

export function OpenRouterIcon() {
  return <img src={glyph} alt="" draggable={false} {...stylex.props(styles.glyph)} />;
}

const styles = stylex.create({
  glyph: { display: "block", inlineSize: 18, blockSize: "auto" },
});
