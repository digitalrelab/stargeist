import { Schema } from "effect";

export const ProviderId = Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]{0,63}$/));

export const ModelId = Schema.String.check(Schema.isPattern(/^[\x21-\x7e]{1,512}$/));
export type ModelId = typeof ModelId.Type;

export const ModelReference = Schema.Struct({
  providerId: ProviderId,
  modelId: ModelId,
});
export type ModelReference = typeof ModelReference.Type;

const TokenPrice = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));

export const ModelPricing = Schema.Struct({
  inputPerMillionTokens: TokenPrice,
  outputPerMillionTokens: TokenPrice,
});
export type ModelPricing = typeof ModelPricing.Type;

export const ModelPublisher = Schema.Struct({
  id: Schema.NonEmptyString.check(Schema.isMaxLength(128)),
  name: Schema.NonEmptyString.check(Schema.isMaxLength(256)),
});
export type ModelPublisher = typeof ModelPublisher.Type;

export const ModelInputModality = Schema.Literals(["text", "image", "video", "audio", "file"]);
export type ModelInputModality = typeof ModelInputModality.Type;

export const ModelCapabilities = Schema.Struct({
  toolCalling: Schema.Boolean,
  reasoning: Schema.NullOr(Schema.Boolean),
  inputModalities: Schema.NullOr(Schema.Array(ModelInputModality)),
  outputModalities: Schema.Array(Schema.String),
});
export type ModelCapabilities = typeof ModelCapabilities.Type;

export const Model = Schema.Struct({
  reference: ModelReference,
  name: Schema.NonEmptyString.check(Schema.isMaxLength(256)),
  publisher: ModelPublisher,
  pricing: Schema.NullOr(ModelPricing),
  capabilities: ModelCapabilities,
});
export type Model = typeof Model.Type;
