import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import * as stylex from "@stylexjs/stylex";
import { colors, radii, shadows, space } from "../tokens.stylex";
import { typography } from "../typography";

export function Root<Payload>(props: BaseTooltip.Root.Props<Payload>) {
  return <BaseTooltip.Root {...props} />;
}

export function Trigger<Payload>(
  props: Omit<BaseTooltip.Trigger.Props<Payload>, "className" | "style">,
) {
  return <BaseTooltip.Trigger {...props} />;
}

type PhysicalSide = "top" | "bottom" | "left" | "right";
type PositionerProps = Pick<BaseTooltip.Positioner.Props, "align" | "sideOffset"> & {
  side?: PhysicalSide;
};
type PopupProps = Omit<BaseTooltip.Popup.Props, "className" | "style"> & PositionerProps;

export function Popup({ align, children, side, sideOffset = 8, ...props }: PopupProps) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        {...stylex.props(styles.positioner)}
      >
        <BaseTooltip.Popup
          {...props}
          {...stylex.props(styles.popup, styles.transition, typography.label)}
        >
          <BaseTooltip.Arrow {...stylex.props(styles.arrow)}>
            <svg aria-hidden="true" viewBox="0 0 12 6" {...stylex.props(styles.arrowShape)}>
              <path d="M0 0h12L6 6Z" fill={colors.surfaceOverlay} />
              <path
                d="M0 0 6 6 12 0"
                fill="none"
                stroke={colors.border}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </BaseTooltip.Arrow>
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

const styles = stylex.create({
  popup: {
    maxWidth: "20rem",
    paddingBlock: space[1],
    paddingInline: space[2],
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceOverlay,
    color: colors.text,
    boxShadow: shadows.raised,
    overflowWrap: "anywhere",
  },
  positioner: { zIndex: 2 },
  transition: {
    opacity: { default: 1, ":is([data-starting-style], [data-ending-style])": 0 },
    transform: {
      default: "translate3d(0, 0, 0)",
      ':is([data-starting-style], [data-ending-style])[data-side="top"]': "translate3d(0, 4px, 0)",
      ':is([data-starting-style], [data-ending-style])[data-side="bottom"]':
        "translate3d(0, -4px, 0)",
      ':is([data-starting-style], [data-ending-style])[data-side="left"]': "translate3d(4px, 0, 0)",
      ':is([data-starting-style], [data-ending-style])[data-side="right"]':
        "translate3d(-4px, 0, 0)",
    },
    transitionProperty: "opacity, transform",
    transitionDuration: {
      default: "100ms",
      "[data-instant]": "0ms",
      "@media (prefers-reduced-motion: reduce)": "0ms",
    },
    transitionTimingFunction: "ease-out",
  },
  arrow: {
    display: "flex",
    width: 12,
    height: 6,
    bottom: { default: "auto", '[data-side="top"]': -5 },
    top: { default: "auto", '[data-side="bottom"]': -5 },
    left: { default: "auto", '[data-side="right"]': -8 },
    right: { default: "auto", '[data-side="left"]': -8 },
    transform: {
      default: "none",
      '[data-side="bottom"]': "rotate(180deg)",
      '[data-side="left"]': "rotate(-90deg)",
      '[data-side="right"]': "rotate(90deg)",
    },
  },
  arrowShape: { display: "block", width: 12, height: 6 },
});
