import { FileId, type FileSnapshot } from "@stargeist/domain";
import { Schema } from "effect";

const decodeId = Schema.decodeUnknownSync(FileId);

export function fileAt(index: number, name = `file-${index}`): FileSnapshot {
  return {
    id: decodeId(`fil_${index.toString(16).padStart(26, "0")}`),
    name,
    kind: "file",
  };
}
