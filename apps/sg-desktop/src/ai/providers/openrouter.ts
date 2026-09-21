import { ProviderConnectionError } from "@stargeist/domain/ai";
import { Effect, Schema, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import type { ProviderAdapter } from "../provider";

const KeyResponse = Schema.fromJsonString(
  Schema.Struct({
    data: Schema.Struct({ is_management_key: Schema.Boolean }),
  }),
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

export const makeOpenRouter = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
  const validate: ProviderAdapter["validate"] = Effect.fnUntraced(
    function* (credential) {
      const response = yield* client
        .execute(
          HttpClientRequest.get("https://openrouter.ai/api/v1/key").pipe(
            HttpClientRequest.bearerToken(credential.key),
            HttpClientRequest.acceptJson,
          ),
        )
        .pipe(Effect.mapError(networkUnavailable));

      if (response.status === 401 || response.status === 403)
        return yield* new ProviderConnectionError({
          code: "InvalidCredential",
          message: "OpenRouter did not accept this API key.",
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
      const text = yield* response.stream.pipe(
        Stream.mapError(networkUnavailable),
        Stream.mapEffect((chunk) => {
          length += chunk.byteLength;
          if (length > 64 * 1024) return Effect.fail(invalidResponse());
          return Effect.succeed(chunk);
        }),
        Stream.decodeText(),
        Stream.mkString,
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

  return {
    id: "openrouter",
    displayName: "OpenRouter",
    credentialKind: "apiKey",
    validate,
  } satisfies ProviderAdapter;
});
