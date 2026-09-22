import { ProviderRegistry } from "@stargeist/ai";
import { Effect, Redacted } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { expect, it, vi } from "vite-plus/test";
import { providersLayer } from "./index";

const key = Redacted.make({ key: "test-secret-key" });

it("validates through the key endpoint without generating content, and prevents redirects", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({ data: { is_management_key: false, unexpected: "ignored" } }),
  );
  await Effect.runPromise(
    Effect.gen(function* () {
      const registry = yield* ProviderRegistry;
      const adapter = yield* registry.get("openrouter");
      const runtime = yield* adapter.open(key);
      yield* runtime.check;
    }).pipe(Effect.provide(providersLayer), Effect.provideService(FetchHttpClient.Fetch, fetch)),
  );
  expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = fetch.mock.calls[0]!;
  expect(url).toEqual(new URL("https://openrouter.ai/api/v1/key"));
  expect(init?.method).toBe("GET");
  expect(init?.redirect).toBe("error");
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-secret-key");
  expect(init?.body).toBeUndefined();
});
