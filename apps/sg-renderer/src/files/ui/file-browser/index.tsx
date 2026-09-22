import { useAtomValue } from "@effect/atom-react";
import { Skeleton, typography } from "@stargeist/ui";
import { colors, control, fonts, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import {
  FileBrowserContext,
  useFileBrowser,
  useFileBrowserContext,
  type FileBrowserProps,
} from "./context";
import { FileSelectionBar } from "./selection-bar";

function Root({ children, ...props }: FileBrowserProps & { children: ReactNode }) {
  const browser = useFileBrowser(props);

  return (
    <FileBrowserContext value={browser}>
      <Content>{children}</Content>
      <Footer />
    </FileBrowserContext>
  );
}

function Content({ children }: { children: ReactNode }) {
  const { contents } = useFileBrowserContext();
  const extent = useAtomValue(contents.extent);
  let content = children;

  if (extent.count === 0 && !extent.hasMore) {
    content = <p {...stylex.props(styles.empty)}>This folder is empty.</p>;
  }

  return (
    <div {...stylex.props(styles.viewport)}>
      {content}
      <div {...stylex.props(styles.overlay)}>
        <FileSelectionBar />
      </div>
    </div>
  );
}

function Footer() {
  const { contents } = useFileBrowserContext();
  const extent = useAtomValue(contents.extent);
  let label = `${extent.count.toLocaleString()} files`;

  if (extent.count === 1) {
    label = "1 file";
  }

  if (extent.hasMore) {
    label += " · Scroll for more";
  }

  return (
    <div {...stylex.props(typography.label, styles.footer)}>
      <span role="status">{label}</span>
    </div>
  );
}

function Loading({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-label="Loading files" {...stylex.props(styles.loading)}>
      <div aria-hidden="true" {...stylex.props(styles.viewport)}>
        {children}
      </div>
      <div aria-hidden="true" {...stylex.props(styles.footer)}>
        <Skeleton styles={styles.countSkeleton} />
      </div>
    </div>
  );
}

export const FileBrowser = { Root, Loading };
export { useFileBrowserContext } from "./context";

const styles = stylex.create({
  viewport: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    isolation: "isolate",
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 0,
    minWidth: 0,
  },
  overlay: {
    position: "absolute",
    insetInline: space[3],
    bottom: space[3],
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 1,
  },
  empty: { padding: space[6], color: colors.textMuted, flexGrow: 1 },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    minHeight: `calc(${control.heightSm} + ${space[6]} + 1px)`,
    flexShrink: 0,
    paddingBlock: space[3],
    paddingInline: space[6],
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: colors.borderSubtle,
    fontWeight: fonts.regular,
    color: colors.textMuted,
  },
  loading: { display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0 },
  countSkeleton: { inlineSize: "5rem", blockSize: space[3] },
});
