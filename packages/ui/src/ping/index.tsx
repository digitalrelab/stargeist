import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { colors, radii } from "../tokens.stylex";

interface PingProps extends Omit<
  ComponentProps<"span">,
  "aria-label" | "children" | "className" | "style"
> {
  label: string;
  tone: "neutral" | "positive" | "negative";
}

export function Ping({ label, tone, ...props }: PingProps) {
  return (
    <span
      {...props}
      {...stylex.props(styles.root, tones[tone], tone === "positive" && styles.animated)}
      role="img"
      aria-label={label}
    />
  );
}

const pulse = stylex.keyframes({
  "0%": { opacity: 0.45, transform: "scale(1)" },
  "70%, 100%": { opacity: 0, transform: "scale(2.25)" },
});

const styles = stylex.create({
  root: {
    position: "relative",
    display: "inline-block",
    inlineSize: 8,
    blockSize: 8,
    flex: "none",
    borderRadius: radii.full,
    backgroundColor: "currentColor",
    outlineStyle: { default: "none", "@media (forced-colors: active)": "solid" },
    outlineWidth: 1,
    outlineColor: "currentColor",
    "::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      borderRadius: radii.full,
      backgroundColor: "currentColor",
    },
  },
  animated: {
    "::before": {
      animationName: { default: pulse, "@media (prefers-reduced-motion: reduce)": "none" },
      animationDuration: "1.8s",
      animationIterationCount: "infinite",
      animationTimingFunction: "ease-out",
    },
  },
});

const tones = stylex.create({
  neutral: { color: colors.statusNeutral },
  positive: { color: colors.statusPositive },
  negative: { color: colors.statusNegative },
});
