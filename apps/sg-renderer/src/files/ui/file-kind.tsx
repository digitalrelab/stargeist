import type { FileSystemEntry } from "@stargeist/domain";
import { FileIcon, FolderIcon, LinkIcon, UnknownFileIcon } from "@stargeist/ui";
import { colors } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const kinds = {
  directory: { label: "Folder", Icon: FolderIcon },
  file: { label: "File", Icon: FileIcon },
  symlink: { label: "Link", Icon: LinkIcon },
  other: { label: "Other", Icon: UnknownFileIcon },
} satisfies Record<FileSystemEntry["kind"], { label: string; Icon: typeof FileIcon }>;

type Props = { kind: FileSystemEntry["kind"] };

function Icon({ kind, decorative = false }: Props & { decorative?: boolean }) {
  const { Icon: KindIcon, label } = kinds[kind];
  let accessibleLabel;

  if (!decorative) {
    accessibleLabel = label;
  }

  return (
    <KindIcon
      {...stylex.props(styles.icon)}
      role="img"
      aria-hidden={decorative}
      aria-label={accessibleLabel}
    />
  );
}

function Label({ kind }: Props) {
  return <>{kinds[kind].label}</>;
}

export const FileKind = { Icon, Label };

const styles = stylex.create({
  icon: { color: colors.textMuted, flexShrink: 0 },
});
