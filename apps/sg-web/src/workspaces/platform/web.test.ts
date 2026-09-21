import { Effect, Layer } from "effect";
import { expect, it } from "vite-plus/test";
import { ClientUnavailableError } from "#src/rpc/index.ts";
import { workspacesLayer } from "./web";

it("reports that workspaces are unavailable through the web implementation", async () => {
  const error = await Effect.runPromise(
    Layer.build(workspacesLayer).pipe(Effect.scoped, Effect.flip),
  );

  expect(error).toEqual(
    new ClientUnavailableError({
      message: "Workspaces are available in the desktop app.",
    }),
  );
});
