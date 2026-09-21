import { WorkspaceId } from "@stargeist/domain/workspaces";
import { Schema } from "effect";
import { clientProtocol } from "@stargeist/std/rpc";
import { Effect } from "effect";
import { expect, it } from "vite-plus/test";
import { makeRpcLibrariesClient } from "../libraries/rpc";
import { makeRpcWorkspacesClient } from "./rpc";

const failingProtocol = (cause: Error) =>
  clientProtocol({
    closed: Effect.never,
    send: () => {
      throw cause;
    },
    listen: () => () => {},
    close: () => {},
  });

it("uses the supplied backend and host protocols and preserves their failure diagnostics", async () => {
  const backendCause = new Error("Backend connection closed");
  const hostCause = new Error("Host connection closed");

  await Effect.runPromise(
    Effect.gen(function* () {
      const backend = yield* failingProtocol(backendCause);
      const host = yield* failingProtocol(hostCause);
      const client = yield* makeRpcWorkspacesClient({ backend, host });

      const listError = yield* client.list().pipe(Effect.flip);
      const createError = yield* client.create().pipe(Effect.flip);
      const libraries = yield* makeRpcLibrariesClient({ backend, host });
      const addError = yield* libraries
        .add({
          workspaceId: Schema.decodeUnknownSync(WorkspaceId)("wsp_00000000000000000000000001"),
        })
        .pipe(Effect.flip);

      expect(listError).toMatchObject({
        _tag: "RpcClientError",
        reason: { cause: backendCause },
      });
      expect(createError).toMatchObject({
        _tag: "RpcClientError",
        reason: { cause: hostCause },
      });
      expect(addError).toMatchObject({
        _tag: "RpcClientError",
        reason: { cause: hostCause },
      });
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
});
