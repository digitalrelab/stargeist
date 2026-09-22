import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type { ProviderAdapter } from "../provider";
import { makeOpenRouter } from "./openrouter";

const http = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { redirect: "error" })),
);

export const makeProviderAdapters = makeOpenRouter.pipe(
  Effect.map((openrouter): ReadonlyArray<ProviderAdapter> => [openrouter]),
  Effect.provide(http),
);
