import { Module } from "@stargeist/application";
import { Context, Effect, Layer } from "effect";
import { DesktopConnection } from "#src/desktop/index.ts";
import { createLibraryState, type LibraryState as State } from "./state";
import { makeRpcLibrariesClient } from "./rpc";

export class LibraryState extends Context.Service<LibraryState, State>()(
  "@stargeist/renderer/LibraryState",
) {}

export const LibraryStateModule = Module.define({
  exports: LibraryState,
  layer: Layer.effect(
    LibraryState,
    Effect.flatMap(DesktopConnection, makeRpcLibrariesClient).pipe(Effect.map(createLibraryState)),
  ),
});
