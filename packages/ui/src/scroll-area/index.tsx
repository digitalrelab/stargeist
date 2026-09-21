import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import * as stylex from "@stylexjs/stylex";
import { colors, focusRing, radii, space } from "../tokens.stylex";

function Root(props: Omit<BaseScrollArea.Root.Props, "className" | "style">) {
  return <BaseScrollArea.Root {...props} {...stylex.props(styles.root)} />;
}

function Viewport(props: Omit<BaseScrollArea.Viewport.Props, "className" | "style">) {
  return <BaseScrollArea.Viewport {...props} {...stylex.props(styles.viewport)} />;
}

function Content(props: Omit<BaseScrollArea.Content.Props, "className" | "style">) {
  return <BaseScrollArea.Content {...props} style={{ minWidth: 0 }} />;
}

function Scrollbar(
  props: Omit<BaseScrollArea.Scrollbar.Props, "className" | "style" | "children">,
) {
  return (
    <BaseScrollArea.Scrollbar {...props} {...stylex.props(styles.scrollbar)}>
      <BaseScrollArea.Thumb {...stylex.props(styles.thumb)} />
    </BaseScrollArea.Scrollbar>
  );
}

export const ScrollArea = { Root, Viewport, Content, Scrollbar };

const styles = stylex.create({
  root: { position: "relative", flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 },
  viewport: {
    width: "100%",
    height: "100%",
    overscrollBehavior: "contain",
    outlineColor: colors.focusRing,
    outlineOffset: `calc(-1 * ${focusRing.width})`,
    outlineWidth: focusRing.width,
    outlineStyle: { default: "none", ":focus-visible:not([aria-activedescendant])": "solid" },
    maskImage: `linear-gradient(to bottom, transparent 0, black min(${space[4]}, var(--scroll-area-overflow-y-start, 0px)), black calc(100% - min(${space[4]}, var(--scroll-area-overflow-y-end, 0px))), transparent 100%)`,
    maskRepeat: "no-repeat",
  },
  scrollbar: {
    display: "flex",
    position: "absolute",
    borderRadius: radii.sm,
    padding: space[0.5],
    width: { default: space[2], '[data-orientation="horizontal"]': "auto" },
    height: { default: "auto", '[data-orientation="horizontal"]': space[2] },
    insetInlineEnd: space[0.5],
    insetInlineStart: { default: "auto", '[data-orientation="horizontal"]': space[0.5] },
    top: { default: space[0.5], '[data-orientation="horizontal"]': "auto" },
    bottom: space[0.5],
  },
  thumb: {
    flexGrow: 1,
    borderRadius: radii.sm,
    backgroundColor: {
      default: colors.border,
      ":hover": colors.borderStrong,
      ":active": colors.borderStrong,
    },
  },
});
