import { MessageChannel, type MessagePort } from "node:worker_threads";
import { ProviderConnectionRpcs } from "@stargeist/protocol/ai";
import { clientProtocol, serverProtocol, type Connection } from "@stargeist/std/rpc";
import { Cause, Deferred, Effect, Fiber, Layer, Redacted, Schema } from "effect";
import { Rpc, RpcClient, RpcGroup, RpcServer } from "effect/unstable/rpc";
import { expect, it } from "vite-plus/test";
import {
  connectionsLayer,
  ProviderConfigurationStore,
  Provider as AIProvider,
  registryLayer,
  type ProviderConfigurationRecord,
} from "@stargeist/ai";
import { ProviderConnectionsEndpoint } from "./host";

const connect = (port: MessagePort): Connection => ({
  send: (message) => port.postMessage(message),
  close: () => port.close(),
  closed: Effect.never,
  listen: (receive, close) => {
    port.on("message", receive);
    port.on("close", close);
    return () => {
      port.off("message", receive);
      port.off("close", close);
    };
  },
});

it("round-trips credentials privately and keeps host requests usable during validation", async () => {
  const Ping = RpcGroup.make(Rpc.make("ping", { success: Schema.String }));
  const contract = ProviderConnectionRpcs.merge(Ping);
  const responses: unknown[] = [];
  await Effect.runPromise(
    Effect.gen(function* () {
      const { port1, port2 } = yield* Effect.acquireRelease(
        Effect.sync(() => new MessageChannel()),
        (ports) =>
          Effect.sync(() => {
            ports.port1.close();
            ports.port2.close();
          }),
      );
      const started = yield* Deferred.make<void>();
      const finish = yield* Deferred.make<void>();
      const records = new Map<string, ProviderConfigurationRecord>();
      const store = Layer.succeed(ProviderConfigurationStore, {
        read: (id) => Effect.sync(() => records.get(id) ?? null),
        write: (record) =>
          Effect.sync(() => {
            records.set(record.providerId, record);
          }),
        remove: (id) =>
          Effect.sync(() => {
            records.delete(id);
          }),
      });
      const providers = registryLayer([
        AIProvider.define({
          id: "first",
          displayName: "First provider",
          configuration: Schema.Struct({ key: Schema.Redacted(Schema.String) }),
        })(
          Effect.succeed({
            describe: () => "••••1234",
            check: (credential) => {
              expect(Redacted.value(credential.key)).toBe("rpc-secret-1234");
              return Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Deferred.await(finish)),
              );
            },
            models: () => Effect.succeed([]),
          }),
        ),
      ]);
      const connections = connectionsLayer.pipe(Layer.provide(providers), Layer.provide(store));
      const serverConnection = connect(port1);
      const protocol = yield* serverProtocol({
        ...serverConnection,
        send: (response) => {
          responses.push(response);
          serverConnection.send(response);
        },
      });
      yield* RpcServer.make(contract, { concurrency: 1 }).pipe(
        Effect.provide(ProviderConnectionsEndpoint.layer.pipe(Layer.provide(connections))),
        Effect.provide(Ping.toLayer({ ping: () => Effect.succeed("pong") })),
        Effect.provideService(RpcServer.Protocol, protocol),
        Effect.forkScoped,
      );
      const clientTransport = yield* clientProtocol(connect(port2));
      const client = yield* RpcClient.make(contract).pipe(
        Effect.provideService(RpcClient.Protocol, clientTransport),
      );
      const pending = yield* client["ai.connections.configure"]({
        providerId: "first",
        configuration: Redacted.make({ key: "rpc-secret-1234" }),
      }).pipe(Effect.forkChild);
      yield* Deferred.await(started);
      expect(yield* client.ping()).toBe("pong");
      expect((yield* client["ai.connections.list"]())[0]?.state.status).toBe("notConfigured");
      expect(
        yield* client["ai.connections.remove"]({ providerId: "first" }).pipe(Effect.flip),
      ).toMatchObject({ code: "Busy" });
      yield* Deferred.succeed(finish, undefined);
      expect((yield* Fiber.join(pending)).state).toMatchObject({
        status: "configured",
        summary: "••••1234",
      });
      expect((yield* client["ai.connections.check"]({ providerId: "first" })).state.status).toBe(
        "configured",
      );
      yield* client["ai.connections.remove"]({ providerId: "first" });
      expect((yield* client["ai.connections.list"]())[0]?.state.status).toBe("notConfigured");
      expect(JSON.stringify(responses)).not.toContain("rpc-secret-1234");
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
});

it("does not echo secrets in malformed configuration errors", () => {
  const request = ProviderConnectionRpcs.requests.get("ai.connections.configure")!;
  const decode = Schema.decodeUnknownExit(Schema.toCodecJson(request.payloadSchema));
  const result = decode({
    providerId: "../bad",
    configuration: { key: "rpc-secret-1234" },
  });
  expect(result._tag).toBe("Failure");
  if (result._tag === "Failure")
    expect(Cause.pretty(result.cause)).not.toContain("rpc-secret-1234");
});
