import { Module } from "@stargeist/application";
import { Context, Effect, Layer } from "effect";
import { DesktopConnection } from "#src/desktop/index.ts";
import { createLibraryState, type LibraryState } from "./state";
import { makeRpcLibrariesClient } from "./rpc";

export class Libraries extends Context.Service<Libraries, LibraryState>()(
  "@stargeist/renderer/Libraries",
) {}

export const LibrariesModule = Module.define({
  exports: Libraries,
  layer: Layer.effect(
    Libraries,
    Effect.flatMap(DesktopConnection, makeRpcLibrariesClient).pipe(Effect.map(createLibraryState)),
  ),
});
