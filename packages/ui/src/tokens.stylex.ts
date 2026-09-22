import * as stylex from "@stylexjs/stylex";

export const space = stylex.defineVars({
  0: "0px",
  0.5: "2px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
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
  paddingInlineSm: space[3],
  paddingInlineMd: space[4],
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

const slateDark = {
  slate1: "oklch(17.853% 0.00407 285.98)",
  slate2: "oklch(21.318% 0.00421 264.48)",
  slate3: "oklch(25.214% 0.00582 271.18)",
  slate4: "oklch(28.319% 0.00699 248.07)",
  slate5: "oklch(31.177% 0.00830 255.56)",
  slate6: "oklch(34.655% 0.01029 253.97)",
  slate7: "oklch(39.928% 0.01206 252.94)",
  slate8: "oklch(48.932% 0.01551 251.69)",
  slate9: "oklch(53.700% 0.01532 262.34)",
  slate10: "oklch(58.251% 0.01454 266.63)",
  slate11: "oklch(76.856% 0.00964 258.34)",
  slate12: "oklch(94.892% 0.00289 264.54)",
};

export const colors = stylex.defineVars({
  backdrop: "oklch(0% 0 0 / 45%)",
  canvas: slateDark.slate1,
  surface: slateDark.slate2,
  surfaceRaised: slateDark.slate3,
  text: slateDark.slate12,
  textMuted: slateDark.slate11,
  borderSubtle: slateDark.slate3,
  border: slateDark.slate6,
  borderStrong: slateDark.slate8,
  action: slateDark.slate12,
  actionHovered: "oklch(100% 0 0)",
  actionPressed: slateDark.slate11,
  onAction: slateDark.slate1,
  danger: "oklch(31% 0.045 25)",
  dangerHovered: "oklch(35% 0.05 25)",
  dangerPressed: "oklch(28% 0.04 25)",
  onDanger: "oklch(78% 0.095 25)",
  control: slateDark.slate3,
  controlHovered: slateDark.slate4,
  controlPressed: slateDark.slate5,
  controlSelected: slateDark.slate5,
  controlDisabled: slateDark.slate3,
  onControl: slateDark.slate12,
  onControlMuted: slateDark.slate11,
  onControlDisabled: slateDark.slate10,
  focusRing: "oklch(77.429% 0.12152 287.46)",
});
