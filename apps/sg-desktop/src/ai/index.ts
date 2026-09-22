import { safeStorage } from "electron";
import { connectionsLayer, modelCatalogLayer } from "@stargeist/ai";
import { AgentModelCatalog } from "@stargeist/domain";
import { Layer } from "effect";
import { agentModelPreferencesLayer } from "./preferences";
import { providersLayer } from "./providers";
import { SecretProtection, createSecretProtection } from "./protection";
import { providerConfigurationStoreLayer } from "./storage";

const protection = Layer.sync(SecretProtection, () =>
  createSecretProtection(safeStorage, process.platform),
);
export const aiServicesLayer = Layer.merge(
  connectionsLayer,
  AgentModelCatalog.layer.pipe(Layer.provide(modelCatalogLayer)),
).pipe(
  Layer.provide(providersLayer),
  Layer.provide(providerConfigurationStoreLayer.pipe(Layer.provide(protection))),
  Layer.merge(agentModelPreferencesLayer),
);

export { AgentModelsEndpoint, ProviderConnectionsEndpoint } from "./host";
