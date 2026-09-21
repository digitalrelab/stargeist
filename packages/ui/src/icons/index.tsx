import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Settings2,
  Palette,
  File,
  FileQuestionMark,
  Folder,
  Link,
  type LucideProps,
} from "lucide-react";
import { control } from "../tokens.stylex";

export function FileIcon(props: LucideProps) {
  return <File size={control.iconSize} {...props} />;
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

export function CheckIcon(props: LucideProps) {
  return <Check size={control.iconSize} {...props} />;
}

export function ChevronDownIcon(props: LucideProps) {
  return <ChevronDown size={control.iconSize} {...props} />;
}

export function ChevronUpIcon(props: LucideProps) {
  return <ChevronUp size={control.iconSize} {...props} />;
}

export function ChevronsUpDownIcon(props: LucideProps) {
  return <ChevronsUpDown size={control.iconSize} {...props} />;
}
