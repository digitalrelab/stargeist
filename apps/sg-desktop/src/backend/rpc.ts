import { LibraryDialogRpcs, LibraryRpcs } from "@stargeist/protocol/libraries";
import { ProviderConnectionRpcs } from "@stargeist/protocol/ai";
import { WorkspaceRpcs, WorkspaceDialogRpcs } from "@stargeist/protocol/workspaces";
import type { RpcClient, RpcClientError } from "effect/unstable/rpc";
import { LibraryControlRpcs } from "../libraries/control";
import { WorkspaceControlRpcs } from "../workspaces/control";

export const ControlRpcs = WorkspaceControlRpcs.merge(LibraryControlRpcs);
export const RendererRpcs = WorkspaceRpcs.merge(LibraryRpcs);
export const HostRpcs = WorkspaceDialogRpcs.merge(LibraryDialogRpcs, ProviderConnectionRpcs);

export type ControlClient = RpcClient.FromGroup<typeof ControlRpcs, RpcClientError.RpcClientError>;
