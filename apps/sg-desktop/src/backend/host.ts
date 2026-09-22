import { clientProtocol } from "@stargeist/std/rpc";
import { MessageChannelMain, type WebContents } from "electron";
import { Effect } from "effect";
import { connectRenderer } from "./renderer";
import { connectPort, type NativePort } from "./port";
import { startBackendProcess } from "./process";

export const openBackend = Effect.gen(function* () {
  const { child, failure } = yield* startBackendProcess;
  const channel = new MessageChannelMain();
  const protocol = yield* clientProtocol(connectPort(channel.port1));
  child.postMessage({ type: "control", id: "host" }, [channel.port2]);
  return {
    protocol,
    failure,
    connect: (contents: WebContents, serveHost: (port: NativePort) => Effect.Effect<void>) =>
      connectRenderer(child, contents, serveHost),
  };
});
