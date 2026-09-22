import type { WebContents } from "electron";
import { Context, type Effect, type Scope } from "effect";

export class WindowConnections extends Context.Service<
  WindowConnections,
  {
    readonly connect: (contents: WebContents) => Effect.Effect<void, never, Scope.Scope>;
  }
>()("@stargeist/desktop/WindowConnections") {}
