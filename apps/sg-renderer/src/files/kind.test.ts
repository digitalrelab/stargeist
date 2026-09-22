import { expect, it } from "vite-plus/test";
import { classifyFileKind } from "./kind";

it("classifies MIME families and product-specific document categories", () => {
  const examples = [
    ["image/jpeg", "image"],
    ["video/quicktime", "video"],
    ["audio/flac", "audio"],
    ["application/pdf", "document"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "document"],
    ["text/markdown", "text"],
    ["text/csv", "spreadsheet"],
    ["application/vnd.oasis.opendocument.spreadsheet", "spreadsheet"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "presentation"],
    ["application/zip", "archive"],
    ["text/javascript", "code"],
    [" TEXT/PLAIN; charset=utf-8 ", "text"],
    ["application/octet-stream", "file"],
    ["application/x-unknown", "file"],
  ] as const;

  for (const [mediaType, kind] of examples) {
    expect(classifyFileKind({ type: "file", mediaType })).toBe(kind);
  }
  expect(classifyFileKind({ type: "file", mediaType: null })).toBe("file");
});

it("gives structural type precedence over content classification", () => {
  expect(classifyFileKind({ type: "folder", mediaType: "image/jpeg" })).toBe("folder");
  expect(classifyFileKind({ type: "link", mediaType: "video/mp4" })).toBe("link");
  expect(classifyFileKind({ type: "other", mediaType: "audio/wav" })).toBe("other");
});
