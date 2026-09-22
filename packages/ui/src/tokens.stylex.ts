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
  slate1: "oklch(16.5% 0.018 268)",
  slate2: "oklch(20.5% 0.019 266)",
  slate3: "oklch(24.5% 0.02 263)",
  slate4: "oklch(28% 0.021 261)",
  slate5: "oklch(31.5% 0.022 259)",
  slate6: "oklch(35.5% 0.023 258)",
  slate7: "oklch(40.5% 0.024 257)",
  slate8: "oklch(49% 0.025 256)",
  slate9: "oklch(54% 0.024 256)",
  slate10: "oklch(59% 0.022 256)",
  slate11: "oklch(77% 0.015 255)",
  slate12: "oklch(95% 0.005 255)",
};

const neutralLayer = {
  subtle: `color-mix(in srgb, ${slateDark.slate12} 4%, transparent)`,
  resting: `color-mix(in srgb, ${slateDark.slate12} 6%, transparent)`,
  emphasized: `color-mix(in srgb, ${slateDark.slate12} 8%, transparent)`,
  strong: `color-mix(in srgb, ${slateDark.slate12} 10%, transparent)`,
};

export const colors = stylex.defineVars({
  backdrop: "oklch(0% 0 0 / 45%)",
  canvas: slateDark.slate1,
  surface: slateDark.slate2,
  surfaceRaised: slateDark.slate3,
  text: slateDark.slate12,
  textMuted: slateDark.slate11,
  borderSubtle: slateDark.slate3,
  divider: slateDark.slate4,
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
  control: neutralLayer.resting,
  controlHovered: neutralLayer.emphasized,
  controlPressed: neutralLayer.strong,
  controlSelected: neutralLayer.emphasized,
  controlDisabled: neutralLayer.subtle,
  onControl: slateDark.slate12,
  onControlMuted: slateDark.slate11,
  onControlDisabled: slateDark.slate10,
  focusRing: "oklch(77.429% 0.12152 287.46)",
});
