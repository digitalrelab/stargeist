import { ModelId, type ModelInputModality, type ModelPricing } from "../models";
import { ProviderConnectionError } from "../errors";
import { Effect, Redacted, Schema, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import * as AIProvider from "../provider";

const Configuration = Schema.Struct({
  key: Schema.Redacted(Schema.String.check(Schema.isPattern(/^[\x21-\x7e]{1,4096}$/))),
});
type Configuration = typeof Configuration.Type;

const KeyResponse = Schema.fromJsonString(
  Schema.Struct({
    data: Schema.Struct({ is_management_key: Schema.Boolean }),
  }),
);
const ModelRecord = Schema.Struct({
  id: ModelId,
  name: Schema.NonEmptyString.check(Schema.isMaxLength(256)),
  supported_parameters: Schema.Array(Schema.String).check(Schema.isMaxLength(128)),
  architecture: Schema.Struct({
    input_modalities: Schema.Array(Schema.String).check(Schema.isMaxLength(16)),
    output_modalities: Schema.Array(Schema.String).check(Schema.isMaxLength(16)),
  }),
  reasoning: Schema.optionalKey(Schema.NullOr(Schema.Struct({}))),
  pricing: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({
        prompt: Schema.String,
        completion: Schema.String,
      }),
    ),
  ),
});
const ModelsResponse = Schema.fromJsonString(
  Schema.Struct({ data: Schema.Array(ModelRecord).check(Schema.isMaxLength(2000)) }),
);
const invalidResponse = () =>
  new ProviderConnectionError({
    code: "InvalidResponse",
    message: "The provider returned an unexpected response. Try again later.",
  });
const networkUnavailable = () =>
  new ProviderConnectionError({
    code: "NetworkUnavailable",
    message: "OpenRouter could not be reached. Check your connection and try again.",
  });

export const OpenRouter = AIProvider.define({
  id: "openrouter",
  displayName: "OpenRouter",
  configuration: Configuration,
})(
  Effect.gen(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    const readResponse = Effect.fnUntraced(function* (
      request: Parameters<typeof client.execute>[0],
      maxBytes: number,
      invalidCredentialMessage: string,
    ) {
      const response = yield* client.execute(request).pipe(Effect.mapError(networkUnavailable));

      if (response.status === 401 || response.status === 403)
        return yield* new ProviderConnectionError({
          code: "InvalidCredential",
          message: invalidCredentialMessage,
        });
      if (response.status === 429)
        return yield* new ProviderConnectionError({
          code: "RateLimited",
          message: "OpenRouter is limiting requests. Try again later.",
        });
      if (response.status >= 500)
        return yield* new ProviderConnectionError({
          code: "ProviderUnavailable",
          message: "OpenRouter is temporarily unavailable. Try again later.",
        });
      if (response.status !== 200) return yield* invalidResponse();

      let length = 0;
      return yield* response.stream.pipe(
        Stream.mapError(networkUnavailable),
        Stream.mapEffect((chunk) => {
          length += chunk.byteLength;
          if (length > maxBytes) return Effect.fail(invalidResponse());
          return Effect.succeed(chunk);
        }),
        Stream.decodeText(),
        Stream.mkString,
      );
    });
    const validate: AIProvider.Implementation<Configuration>["check"] = Effect.fnUntraced(
      function* (credential) {
        const text = yield* readResponse(
          HttpClientRequest.get("https://openrouter.ai/api/v1/key").pipe(
            HttpClientRequest.bearerToken(credential.key),
            HttpClientRequest.acceptJson,
          ),
          64 * 1024,
          "OpenRouter did not accept this API key.",
        );
        const result = yield* Schema.decodeUnknownEffect(KeyResponse)(text).pipe(
          Effect.mapError(invalidResponse),
        );
        if (result.data.is_management_key)
          return yield* new ProviderConnectionError({
            code: "UnsupportedCredential",
            message: "Use an OpenRouter inference API key, not a management key.",
          });
      },
      Effect.scoped,
      Effect.timeout("15 seconds"),
      Effect.catchTag("TimeoutError", () =>
        Effect.fail(
          new ProviderConnectionError({
            code: "NetworkUnavailable",
            message: "OpenRouter took too long to respond. Try again.",
          }),
        ),
      ),
    );

    const listModels: AIProvider.Implementation<Configuration>["models"] = Effect.fnUntraced(
      function* (credential) {
        const text = yield* readResponse(
          HttpClientRequest.get("https://openrouter.ai/api/v1/models").pipe(
            HttpClientRequest.setUrlParams({
              output_modalities: "all",
              sort: "most-popular",
            }),
            HttpClientRequest.bearerToken(credential.key),
            HttpClientRequest.acceptJson,
          ),
          16 * 1024 * 1024,
          "OpenRouter did not accept the saved API key.",
        );
        const result = yield* Schema.decodeUnknownEffect(ModelsResponse)(text).pipe(
          Effect.mapError(invalidResponse),
        );
        const models: AIProvider.ModelDescriptor[] = [];
        for (const model of result.data) {
          const identity = normalizeModelIdentity(model.id, model.name);
          models.push({
            id: model.id,
            ...identity,
            capabilities: {
              toolCalling: model.supported_parameters.includes("tools"),
              reasoning:
                model.reasoning != null || model.supported_parameters.includes("reasoning"),
              inputModalities: normalizeInputModalities(model.architecture.input_modalities),
              outputModalities: model.architecture.output_modalities,
            },
            pricing: normalizePricing(model.pricing),
          });
        }
        return models;
      },
      Effect.scoped,
      Effect.timeout("15 seconds"),
      Effect.catchTag("TimeoutError", () =>
        Effect.fail(
          new ProviderConnectionError({
            code: "NetworkUnavailable",
            message: "OpenRouter took too long to return its models. Try again.",
          }),
        ),
      ),
    );

    return {
      describe: (configuration) => {
        const key = Redacted.value(configuration.key);
        if (key.length > 8) return `••••${key.slice(-4)}`;
        return "••••";
      },
      check: validate,
      models: listModels,
    } satisfies AIProvider.Implementation<Configuration>;
  }),
);

function normalizePricing(
  pricing:
    | {
        readonly prompt: string;
        readonly completion: string;
      }
    | null
    | undefined,
): ModelPricing | null {
  if (!pricing) return null;
  const inputPerMillionTokens = pricePerMillionTokens(pricing.prompt);
  const outputPerMillionTokens = pricePerMillionTokens(pricing.completion);
  if (inputPerMillionTokens === null || outputPerMillionTokens === null) return null;
  return { inputPerMillionTokens, outputPerMillionTokens };
}

function normalizeInputModalities(modalities: ReadonlyArray<string>) {
  const normalized: ModelInputModality[] = [];
  for (const modality of modalities) {
    switch (modality) {
      case "text":
      case "image":
      case "video":
      case "audio":
      case "file":
        if (!normalized.includes(modality)) normalized.push(modality);
    }
  }
  return normalized;
}

function normalizeModelIdentity(id: string, name: string) {
  const publisherId = modelPublisherId(id);
  const separator = name.indexOf(":");
  if (separator < 0) return { name, publisher: { id: publisherId, name: publisherId } };
  const publisherName = name.slice(0, separator).trim();
  const modelName = name.slice(separator + 1).trim();
  const normalizedPublisher = publisherName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedId = publisherId.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (
    publisherName.length === 0 ||
    modelName.length === 0 ||
    normalizedPublisher !== normalizedId
  ) {
    return { name, publisher: { id: publisherId, name: publisherId } };
  }
  return { name: modelName, publisher: { id: publisherId, name: publisherName } };
}

function modelPublisherId(modelId: string) {
  const separator = modelId.indexOf("/");
  let publisherId = modelId;
  if (separator >= 0) publisherId = modelId.slice(0, separator);
  if (publisherId.startsWith("~")) publisherId = publisherId.slice(1);
  return publisherId;
}

function pricePerMillionTokens(pricePerToken: string) {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(pricePerToken)) return null;
  const price = Number(pricePerToken) * 1_000_000;
  if (!Number.isFinite(price) || price < 0) return null;
  return price;
}
