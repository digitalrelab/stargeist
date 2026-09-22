import { Schema } from "effect";
import type { FileType } from "./file";
import type { MetadataDefinition } from "./metadata";

export const FileKind = Schema.Literals([
  "image",
  "video",
  "audio",
  "document",
  "text",
  "spreadsheet",
  "presentation",
  "archive",
  "code",
  "file",
  "folder",
  "link",
  "other",
]);
export type FileKind = typeof FileKind.Type;

export const FileKindMetadata = {
  key: "kind",
  schema: FileKind,
} as const satisfies MetadataDefinition<FileKind>;

const mediaKinds = new Map<string, FileKind>([
  ["application/pdf", "document"],
  ["application/msword", "document"],
  ["application/rtf", "document"],
  ["application/epub+zip", "document"],
  ["text/rtf", "document"],
  ["text/csv", "spreadsheet"],
  ["text/tab-separated-values", "spreadsheet"],
  ["application/zip", "archive"],
  ["application/gzip", "archive"],
  ["application/x-tar", "archive"],
  ["application/x-7z-compressed", "archive"],
  ["application/vnd.rar", "archive"],
  ["application/x-rar-compressed", "archive"],
  ["application/x-bzip2", "archive"],
  ["application/x-xz", "archive"],
  ["application/json", "code"],
  ["application/xml", "code"],
  ["application/javascript", "code"],
  ["text/javascript", "code"],
  ["text/html", "code"],
  ["text/css", "code"],
  ["text/xml", "code"],
]);

const mediaFamilies: ReadonlyArray<readonly [string, FileKind]> = [
  ["image/", "image"],
  ["video/", "video"],
  ["audio/", "audio"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.", "document"],
  ["application/vnd.oasis.opendocument.text", "document"],
  ["application/vnd.ms-word.", "document"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.", "spreadsheet"],
  ["application/vnd.oasis.opendocument.spreadsheet", "spreadsheet"],
  ["application/vnd.ms-excel", "spreadsheet"],
  ["application/vnd.openxmlformats-officedocument.presentationml.", "presentation"],
  ["application/vnd.oasis.opendocument.presentation", "presentation"],
  ["application/vnd.ms-powerpoint", "presentation"],
  ["application/vnd.apple.keynote", "presentation"],
  ["text/", "text"],
];

export function classifyFileKind(file: { type: FileType; mediaType: string | null }): FileKind {
  if (file.type !== "file") return file.type;
  if (file.mediaType === null) return "file";

  const mediaType = file.mediaType.split(";", 1)[0]!.trim().toLowerCase();
  const kind = mediaKinds.get(mediaType);
  if (kind) return kind;

  for (const [prefix, category] of mediaFamilies) {
    if (mediaType.startsWith(prefix)) return category;
  }

  return "file";
}
