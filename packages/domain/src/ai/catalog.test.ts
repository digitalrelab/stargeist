import {
  ModelCatalog,
  ProviderConnectionError,
  type Model,
  type ProviderModelCatalog,
} from "@stargeist/ai";
import { Effect, Layer } from "effect";
import { expect, it } from "vite-plus/test";
import { AgentModelCatalog } from "./index";

it("limits agent choices to tool-capable text models without changing the generic catalog or provider states", async () => {
  const text: Model = {
    reference: { providerId: "example", modelId: "text-tools" },
    name: "Text with tools",
    publisher: { id: "example", name: "Example" },
    pricing: null,
    capabilities: {
      toolCalling: true,
      reasoning: false,
      inputModalities: ["text"],
      outputModalities: ["text"],
    },
  };
  const textOnly: Model = {
    ...text,
    reference: { providerId: "example", modelId: "text-only" },
    capabilities: {
      toolCalling: false,
      reasoning: false,
      inputModalities: ["text"],
      outputModalities: ["text"],
    },
  };
  const image: Model = {
    ...text,
    reference: { providerId: "example", modelId: "image-tools" },
    capabilities: {
      toolCalling: true,
      reasoning: false,
      inputModalities: ["text"],
      outputModalities: ["image"],
    },
  };
  const multimodal: Model = {
    ...text,
    reference: { providerId: "example", modelId: "multimodal-tools" },
    capabilities: {
      toolCalling: true,
      reasoning: false,
      inputModalities: ["text", "image"],
      outputModalities: ["image", "text"],
    },
  };
  const imageInputOnly: Model = {
    ...text,
    reference: { providerId: "example", modelId: "image-input-only" },
    capabilities: { ...text.capabilities, inputModalities: ["image"] },
  };
  const unknownInput: Model = {
    ...text,
    reference: { providerId: "example", modelId: "unknown-input" },
    capabilities: { ...text.capabilities, inputModalities: null },
  };
  const catalogs: ReadonlyArray<ProviderModelCatalog> = [
    {
      providerId: "example",
      displayName: "Example",
      state: {
        status: "available",
        models: [text, textOnly, image, multimodal, imageInputOnly, unknownInput],
      },
    },
    {
      providerId: "empty",
      displayName: "No eligible models",
      state: {
        status: "available",
        models: [{ ...image, reference: { providerId: "empty", modelId: "image-tools" } }],
      },
    },
    { providerId: "unconfigured", displayName: "Unconfigured", state: { status: "notConfigured" } },
    {
      providerId: "offline",
      displayName: "Offline",
      state: {
        status: "unavailable",
        error: new ProviderConnectionError({ code: "NetworkUnavailable", message: "Offline" }),
      },
    },
  ];
  const models = await Effect.runPromise(
    Effect.gen(function* () {
      const catalog = yield* AgentModelCatalog;
      return yield* catalog.list;
    }).pipe(
      Effect.provide(
        AgentModelCatalog.layer.pipe(
          Layer.provide(Layer.succeed(ModelCatalog, { list: Effect.succeed(catalogs) })),
        ),
      ),
    ),
  );
  expect(models).toEqual([
    {
      providerId: "example",
      displayName: "Example",
      state: { status: "available", models: [text, multimodal] },
    },
    {
      providerId: "empty",
      displayName: "No eligible models",
      state: { status: "available", models: [] },
    },
    catalogs[2],
    catalogs[3],
  ]);
  expect(catalogs[0]?.state).toEqual({
    status: "available",
    models: [text, textOnly, image, multimodal, imageInputOnly, unknownInput],
  });
});
