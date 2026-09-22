import * as Id from "@stargeist/std/id";
import { DirectoryListingPage } from "../filesystem";
import { Schema } from "effect";

export const workspaceDirectoryName = ".stargeist";

export const { schema: WorkspaceId, generate: makeWorkspaceId } = Id.define("wsp");
export type WorkspaceId = typeof WorkspaceId.Type;

export class Workspace extends Schema.Class<Workspace>("Workspace")({
  id: WorkspaceId,
  root: Schema.NonEmptyString,
}) {}

export const WorkspaceView = Schema.Struct({
  workspace: Workspace,
  directory: DirectoryListingPage,
});
export type WorkspaceView = typeof WorkspaceView.Type;
