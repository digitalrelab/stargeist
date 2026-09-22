import { useAtomValue } from "@effect/atom-react";
import { FileSearchIcon, typography } from "@stargeist/ui";
import { colors, fonts, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { SecondarySidebar } from "#src/shell/index.ts";
import { FileKind } from "../file-kind";
import { useFileInspection } from "./context";
import { describeFileInspection, type FileInspection } from "./state";

export function FileInspector() {
  const inspection = useFileInspection();
  const target = useAtomValue(inspection.target);
  let content = <EmptyInspection />;

  if (target) {
    content = (
      <>
        <SecondarySidebar.Header>
          <h2 {...stylex.props(typography.label, styles.heading)}>File details</h2>
        </SecondarySidebar.Header>
        <SecondarySidebar.Content>
          <InspectionContent target={target} />
        </SecondarySidebar.Content>
      </>
    );
  }

  return <SecondarySidebar.Root aria-label="File details">{content}</SecondarySidebar.Root>;
}

function EmptyInspection() {
  return (
    <div {...stylex.props(styles.empty)}>
      <FileSearchIcon
        aria-hidden="true"
        size={32}
        strokeWidth={1.5}
        {...stylex.props(styles.emptyIcon)}
      />
      <p {...stylex.props(typography.label, styles.emptyMessage)}>Select files to see details</p>
    </div>
  );
}

function InspectionContent({ target }: { target: FileInspection }) {
  const description = describeFileInspection(target);

  if (description.type === "selection") {
    return <p {...stylex.props(typography.label)}>{description.label}</p>;
  }

  const { folder } = target.files;

  return (
    <dl {...stylex.props(typography.label, styles.details)}>
      <div {...stylex.props(styles.field)}>
        <dt {...stylex.props(styles.label)}>Name</dt>
        <dd {...stylex.props(styles.value)} data-selectable>
          {description.name}
        </dd>
      </div>
      {description.kind && (
        <div {...stylex.props(styles.field)}>
          <dt {...stylex.props(styles.label)}>Kind</dt>
          <dd {...stylex.props(styles.kind)}>
            <FileKind.Icon kind={description.kind} decorative />
            <FileKind.Label kind={description.kind} />
          </dd>
        </div>
      )}
      {folder && (
        <div {...stylex.props(styles.field)}>
          <dt {...stylex.props(styles.label)}>Folder</dt>
          <dd {...stylex.props(styles.value)} data-selectable>
            {folder}
          </dd>
        </div>
      )}
    </dl>
  );
}

const styles = stylex.create({
  heading: { minWidth: 0, overflowWrap: "anywhere" },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: space[3],
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
    padding: space[6],
    textAlign: "center",
    color: colors.statusNeutral,
  },
  emptyIcon: { flexShrink: 0 },
  emptyMessage: {
    maxWidth: "14rem",
    margin: 0,
    fontWeight: fonts.regular,
  },
  details: {
    display: "flex",
    flexDirection: "column",
    gap: space[6],
    fontWeight: fonts.regular,
    margin: 0,
  },
  field: { display: "flex", flexDirection: "column", gap: space[2], minWidth: 0 },
  label: { color: colors.textMuted },
  value: { overflowWrap: "anywhere", margin: 0 },
  kind: { display: "flex", alignItems: "center", gap: space[2], margin: 0 },
});
