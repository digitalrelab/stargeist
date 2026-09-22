import {
  ModelReference,
  ConfigureProvider,
  ProviderConnection,
  ProviderConnectionError,
  ProviderId,
  ProviderModelCatalog,
} from "@stargeist/ai";
import { AgentModelPreferenceError } from "@stargeist/domain";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

export const ProviderConnectionRpcs = RpcGroup.make(
  Rpc.make("list", { success: Schema.Array(ProviderConnection) }),
  Rpc.make("configure", {
    payload: ConfigureProvider,
    success: ProviderConnection,
    error: ProviderConnectionError,
  }),
  Rpc.make("check", {
    payload: { providerId: ProviderId },
    success: ProviderConnection,
    error: ProviderConnectionError,
  }),
  Rpc.make("remove", {
    payload: { providerId: ProviderId },
    success: Schema.Void,
    error: ProviderConnectionError,
  }),
).prefix("ai.connections.");

export const AgentModelRpcs = RpcGroup.make(
  Rpc.make("list", { success: Schema.Array(ProviderModelCatalog) }),
  Rpc.make("getDefault", {
    success: Schema.NullOr(ModelReference),
    error: AgentModelPreferenceError,
  }),
  Rpc.make("setDefault", {
    payload: { model: ModelReference },
    success: Schema.Void,
    error: AgentModelPreferenceError,
  }),
).prefix("ai.models.");
