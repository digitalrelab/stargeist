import * as stylex from "@stylexjs/stylex";

export const space = stylex.defineVars({
  0: "0px",
  0.5: "2px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
});

export const radii = stylex.defineVars({
  sm: "4px",
  md: "8px",
  lg: "12px",
});

export const fonts = stylex.defineVars({
  body: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  labelSize: "0.875rem",
  bodySize: "1rem",
  headingSize: "1.5rem",
  displaySize: "clamp(2.25rem, 7vw, 4rem)",
  regular: "400",
  medium: "500",
  semibold: "600",
  bodyLeading: "1.5",
  labelLeading: "1.5",
  headingLeading: "1.25",
  headingTracking: "-0.02em",
  displayLeading: "1.1",
  displayTracking: "-0.04em",
});

export const control = stylex.defineVars({
  heightSm: "32px",
  heightMd: "40px",
  radius: radii.md,
  iconSize: "16px",
});

export const focusRing = stylex.defineVars({
  width: "2px",
  offset: "2px",
});

export const shadows = stylex.defineVars({
  raised: "0 8px 24px oklch(0% 0 0 / 32%)",
});
