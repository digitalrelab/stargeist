import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { registryLayer } from "@stargeist/ai";
import { OpenRouter } from "@stargeist/ai/providers/openrouter";

const http = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { redirect: "error" })),
);

export const providersLayer = registryLayer([OpenRouter]).pipe(Layer.provide(http));
