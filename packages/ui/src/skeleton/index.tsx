import * as stylex from "@stylexjs/stylex";
import { colors, radii } from "../tokens.stylex";

interface SkeletonProps {
  styles?: stylex.StyleXStyles<
    Partial<
      Pick<stylex.CSSProperties, "inlineSize" | "blockSize" | "maxInlineSize" | "borderRadius">
    >
  >;
}

export function Skeleton({ styles: customStyles }: SkeletonProps) {
  return <span aria-hidden="true" {...stylex.props(styles.root, customStyles)} />;
}

const pulse = stylex.keyframes({
  "0%, 100%": { opacity: 1 },
  "50%": { opacity: 0.5 },
});

const styles = stylex.create({
  root: {
    display: "inline-block",
    verticalAlign: "middle",
    inlineSize: "100%",
    maxInlineSize: "100%",
    blockSize: "1em",
    flexShrink: 0,
    borderRadius: radii.sm,
    backgroundColor: colors.control,
    animationName: { default: pulse, "@media (prefers-reduced-motion: reduce)": "none" },
    animationDuration: "1.6s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    outlineStyle: { default: "none", "@media (forced-colors: active)": "solid" },
    outlineWidth: 1,
    outlineColor: "GrayText",
    outlineOffset: -1,
  },
});
