import { LibraryDialogRpcs, LibraryRpcs } from "@stargeist/domain/libraries/rpc";
import { WorkspaceRpcs, WorkspaceDialogRpcs } from "@stargeist/domain/workspaces/rpc";
import type { RpcClient, RpcClientError } from "effect/unstable/rpc";
import { LibraryControlRpcs } from "../libraries/control";
import { WorkspaceControlRpcs } from "../workspaces/control";

export const ControlRpcs = WorkspaceControlRpcs.merge(LibraryControlRpcs);
export const RendererRpcs = WorkspaceRpcs.merge(LibraryRpcs);
export const HostRpcs = WorkspaceDialogRpcs.merge(LibraryDialogRpcs);

export type ControlClient = RpcClient.FromGroup<typeof ControlRpcs, RpcClientError.RpcClientError>;
