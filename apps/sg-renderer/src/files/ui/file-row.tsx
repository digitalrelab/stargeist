import type { FileSystemEntry } from "@stargeist/domain";
import { FileIcon, FolderIcon, LinkIcon, UnknownFileIcon, typography } from "@stargeist/ui";
import { colors, control, fonts, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const kinds = {
  directory: { label: "Folder", Icon: FolderIcon },
  file: { label: "File", Icon: FileIcon },
  symlink: { label: "Link", Icon: LinkIcon },
  other: { label: "Other", Icon: UnknownFileIcon },
} satisfies Record<FileSystemEntry["kind"], { label: string; Icon: typeof FileIcon }>;

export function FileRow({ entry }: { entry: FileSystemEntry }) {
  const { label, Icon } = kinds[entry.kind];

  return (
    <div {...stylex.props(typography.label, styles.row)}>
      <Icon {...stylex.props(styles.icon)} role="img" aria-label={label} />
      <span {...stylex.props(styles.name)} title={entry.name}>
        {entry.name}
      </span>
    </div>
  );
}

const styles = stylex.create({
  row: {
    display: "grid",
    gridTemplateColumns: `${control.iconSize} minmax(0, 1fr)`,
    alignItems: "center",
    gap: space[3],
    height: "100%",
    paddingInline: space[6],
    fontWeight: fonts.regular,
  },
  icon: { color: colors.textMuted },
  name: { color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});
