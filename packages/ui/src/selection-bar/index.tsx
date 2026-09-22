import * as stylex from "@stylexjs/stylex";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import * as m from "motion/react-m";
import type { ComponentProps, ReactNode } from "react";
import { colors, radii, shadows, space } from "../tokens.stylex";
import { typography } from "../typography";

interface RootProps {
  open: boolean;
  children: ReactNode;
  "aria-label": string;
  onKeyDown?: ComponentProps<"div">["onKeyDown"];
}

function Root({ open, ...props }: RootProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>{open && <Surface key="selection-bar" {...props} />}</AnimatePresence>
    </LazyMotion>
  );
}

function Surface(props: Omit<RootProps, "open">) {
  const present = useIsPresent();
  const reducedMotion = useReducedMotion();
  let offset = 12;
  let duration = 0.16;

  if (reducedMotion) {
    offset = 0;
    duration = 0;
  }

  return (
    <m.div
      {...props}
      {...stylex.props(typography.label, styles.root)}
      role="group"
      inert={!present}
      initial={{ opacity: 0, y: offset }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: offset }}
      transition={{ duration, ease: [0.2, 0.8, 0.2, 1] }}
    />
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <span role="status" {...stylex.props(styles.status)}>
      {children}
    </span>
  );
}

export const SelectionBar = { Root, Status };

const styles = stylex.create({
  root: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space[2],
    minWidth: 0,
    maxWidth: "100%",
    padding: space[2],
    borderRadius: radii.full,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    boxShadow: shadows.raised,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.borderSubtle,
    pointerEvents: "auto",
  },
  status: {
    paddingInline: space[3],
    minWidth: 0,
    flexGrow: 1,
    overflowWrap: "anywhere",
    fontVariantNumeric: "tabular-nums",
  },
});
