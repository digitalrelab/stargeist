import * as Id from "@stargeist/std/id";
import { Schema } from "effect";
import { WorkspaceId } from "../workspaces";

export const { schema: LibraryId, generate: makeLibraryId } = Id.define("lib");

export type LibraryId = typeof LibraryId.Type;

export const LibrarySource = Schema.Struct({
  kind: Schema.Literal("local-fs"),
  path: Schema.String,
});

export class Library extends Schema.Class<Library>("Library")({
  id: LibraryId,
  workspaceId: WorkspaceId,
  displayName: Schema.String.check(Schema.isNonEmpty()),
  source: LibrarySource,
  createdAt: Schema.Number,
}) {}
