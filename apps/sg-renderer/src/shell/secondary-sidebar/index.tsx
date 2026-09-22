import { ScrollArea } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { Layout } from "./resizer";
import { surface } from "../surface";

type Props<T extends "aside" | "div"> = Omit<ComponentProps<T>, "className" | "style">;

function Root(props: Props<"aside">) {
  return <aside {...props} {...stylex.props(surface.root, styles.root)} />;
}

function Header(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.header)} />;
}

function Content(props: Props<"div">) {
  return (
    <ScrollArea.Root>
      <ScrollArea.Viewport>
        <ScrollArea.Content {...props} render={<div {...stylex.props(styles.content)} />} />
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar />
    </ScrollArea.Root>
  );
}

export const SecondarySidebar = { Layout, Root, Header, Content };

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    gap: space[3],
    paddingInlineStart: space[4],
    paddingInlineEnd: space[2],
    paddingBlock: space[2],
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.borderSubtle,
  },
  content: { padding: space[4] },
});
