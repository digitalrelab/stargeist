import { FileId, type File } from "@stargeist/domain";
import { Schema } from "effect";

const decodeId = Schema.decodeUnknownSync(FileId);

export function fileAt(index: number, name = `file-${index}`): File {
  return {
    id: decodeId(`fil_${index.toString(16).padStart(26, "0")}`),
    name,
    type: "file",
    mediaType: null,
  };
}
