import * as Id from "@stargeist/std/id";
import { Schema } from "effect";

export const { schema: WorkspaceId, generate: makeWorkspaceId } = Id.define("wsp");

export type WorkspaceId = typeof WorkspaceId.Type;

export class Workspace extends Schema.Class<Workspace>("Workspace")({
  id: WorkspaceId,
  displayName: Schema.String.check(Schema.isNonEmpty()),
  createdAt: Schema.Number,
}) {}
