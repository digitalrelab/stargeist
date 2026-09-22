import {
  ArrowLeft,
  Check,
  Command,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Settings2,
  Palette,
  Astroid,
  CircleAlert,
  File,
  FileImage,
  FileVideoCamera,
  FileAudio,
  FileText,
  FileType,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  FileCode,
  FileQuestionMark,
  Folder,
  Link,
  Minus,
  Pencil,
  Trash2,
  Tags,
  X,
  type LucideProps,
} from "lucide-react";
import { control } from "../tokens.stylex";

export function CloseIcon(props: LucideProps) {
  return <X size={control.iconSize} {...props} />;
}

export function FileIcon(props: LucideProps) {
  return <File size={control.iconSize} {...props} />;
}

export function ImageFileIcon(props: LucideProps) {
  return <FileImage size={control.iconSize} {...props} />;
}

export function VideoFileIcon(props: LucideProps) {
  return <FileVideoCamera size={control.iconSize} {...props} />;
}

export function AudioFileIcon(props: LucideProps) {
  return <FileAudio size={control.iconSize} {...props} />;
}

export function DocumentFileIcon(props: LucideProps) {
  return <FileText size={control.iconSize} {...props} />;
}

export function TextFileIcon(props: LucideProps) {
  return <FileType size={control.iconSize} {...props} />;
}

export function SpreadsheetFileIcon(props: LucideProps) {
  return <FileSpreadsheet size={control.iconSize} {...props} />;
}

export function PresentationFileIcon(props: LucideProps) {
  return <Presentation size={control.iconSize} {...props} />;
}

export function ArchiveFileIcon(props: LucideProps) {
  return <FileArchive size={control.iconSize} {...props} />;
}

export function CodeFileIcon(props: LucideProps) {
  return <FileCode size={control.iconSize} {...props} />;
}

export function FolderIcon(props: LucideProps) {
  return <Folder size={control.iconSize} {...props} />;
}

export function LinkIcon(props: LucideProps) {
  return <Link size={control.iconSize} {...props} />;
}

export function UnknownFileIcon(props: LucideProps) {
  return <FileQuestionMark size={control.iconSize} {...props} />;
}

export function BackIcon(props: LucideProps) {
  return <ArrowLeft size={control.iconSize} {...props} />;
}

export function SettingsIcon(props: LucideProps) {
  return <Settings2 size={control.iconSize} {...props} />;
}

export function AppearanceIcon(props: LucideProps) {
  return <Palette size={control.iconSize} {...props} />;
}

export function AIIcon(props: LucideProps) {
  return <Astroid size={control.iconSize} {...props} />;
}

export function CheckIcon(props: LucideProps) {
  return <Check size={control.iconSize} {...props} />;
}

export function MinusIcon(props: LucideProps) {
  return <Minus size={control.iconSize} {...props} />;
}

export function ChevronDownIcon(props: LucideProps) {
  return <ChevronDown size={control.iconSize} {...props} />;
}

export function ChevronRightIcon(props: LucideProps) {
  return <ChevronRight size={control.iconSize} {...props} />;
}

export function ChevronUpIcon(props: LucideProps) {
  return <ChevronUp size={control.iconSize} {...props} />;
}

export function ChevronsUpDownIcon(props: LucideProps) {
  return <ChevronsUpDown size={control.iconSize} {...props} />;
}

export function CommandIcon(props: LucideProps) {
  return <Command size={control.iconSize} {...props} />;
}

export function DeleteIcon(props: LucideProps) {
  return <Trash2 size={control.iconSize} {...props} />;
}

export function EditIcon(props: LucideProps) {
  return <Pencil size={control.iconSize} {...props} />;
}

export function ErrorIcon(props: LucideProps) {
  return <CircleAlert size={control.iconSize} {...props} />;
}

export function TagsIcon(props: LucideProps) {
  return <Tags size={control.iconSize} {...props} />;
}
