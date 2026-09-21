import { Skeleton } from "@stargeist/ui";
import { control, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { layout } from "./layout";

const placeholderRows = Array.from({ length: 8 }, (_, index) => index);

export function FileListSkeleton() {
  return (
    <div role="status" aria-label="Loading files" {...stylex.props(styles.root)}>
      <div aria-hidden="true" {...stylex.props(styles.rows)}>
        {placeholderRows.map((index) => (
          <div key={index} {...stylex.props(layout.row)}>
            <div {...stylex.props(layout.nameCell, layout.name)}>
              <FileNameSkeleton />
            </div>
          </div>
        ))}
      </div>
      <div {...stylex.props(layout.footer)}>
        <Skeleton styles={styles.count} />
      </div>
    </div>
  );
}

export function FileNameSkeleton() {
  return (
    <>
      <Skeleton styles={styles.icon} />
      <Skeleton styles={styles.name} />
    </>
  );
}

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0 },
  rows: { flexGrow: 1, minHeight: 0, overflow: "hidden", padding: space[2] },
  icon: { inlineSize: control.iconSize, blockSize: control.iconSize },
  name: { inlineSize: "min(60%, 24rem)", blockSize: space[3] },
  count: { inlineSize: "5rem", blockSize: space[3] },
});
