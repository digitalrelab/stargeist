import type { File } from "@stargeist/domain";
import {
  FileIcon,
  FolderIcon,
  LinkIcon,
  UnknownFileIcon,
  ImageFileIcon,
  VideoFileIcon,
  AudioFileIcon,
  DocumentFileIcon,
  TextFileIcon,
  SpreadsheetFileIcon,
  PresentationFileIcon,
  ArchiveFileIcon,
  CodeFileIcon,
} from "@stargeist/ui";
import { colors } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { classifyFileKind, type FileKind as Kind } from "../kind";

const kinds = {
  image: { label: "Image", Icon: ImageFileIcon, color: colors.accentGreen },
  video: { label: "Video", Icon: VideoFileIcon, color: colors.accentPurple },
  audio: { label: "Audio", Icon: AudioFileIcon, color: colors.accentPurple },
  document: { label: "Document", Icon: DocumentFileIcon, color: colors.accentBlue },
  text: { label: "Text", Icon: TextFileIcon, color: colors.textMuted },
  spreadsheet: { label: "Spreadsheet", Icon: SpreadsheetFileIcon, color: colors.accentGreen },
  presentation: {
    label: "Presentation",
    Icon: PresentationFileIcon,
    color: colors.accentOrange,
  },
  archive: { label: "Archive", Icon: ArchiveFileIcon, color: colors.accentAmber },
  code: { label: "Code", Icon: CodeFileIcon, color: colors.accentBlue },
  folder: { label: "Folder", Icon: FolderIcon, color: colors.accentAmber },
  file: { label: "File", Icon: FileIcon, color: colors.textMuted },
  link: { label: "Link", Icon: LinkIcon, color: colors.textMuted },
  other: { label: "Other", Icon: UnknownFileIcon, color: colors.textMuted },
} satisfies Record<Kind, { label: string; Icon: typeof FileIcon; color: string }>;

type Props = { entry: File };

function Icon({ entry, decorative = false }: Props & { decorative?: boolean }) {
  const { Icon: KindIcon, label, color } = kinds[classifyFileKind(entry)];
  let accessibleLabel;

  if (!decorative) {
    accessibleLabel = label;
  }

  return (
    <KindIcon
      {...stylex.props(styles.icon(color))}
      role="img"
      aria-hidden={decorative}
      aria-label={accessibleLabel}
    />
  );
}

function Label({ entry }: Props) {
  return <>{kinds[classifyFileKind(entry)].label}</>;
}

export const FileKind = { Icon, Label };

const styles = stylex.create({
  icon: (color: string) => ({ color, flexShrink: 0 }),
});
