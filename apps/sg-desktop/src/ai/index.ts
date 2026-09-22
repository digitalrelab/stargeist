import { safeStorage } from "electron";
import { Effect, Layer } from "effect";
import { connectionsLayer } from "./connections";
import { makeProviderAdapters } from "./providers";
import { SecretProtection, createSecretProtection } from "./protection";
import { credentialsLayer } from "./storage";

const protection = Layer.sync(SecretProtection, () =>
  createSecretProtection(safeStorage, process.platform),
);
export const aiProviderConnectionsLayer = Layer.unwrap(
  makeProviderAdapters.pipe(Effect.map(connectionsLayer)),
).pipe(Layer.provide(credentialsLayer.pipe(Layer.provide(protection))));

export { ProviderConnectionsEndpoint } from "./host";
