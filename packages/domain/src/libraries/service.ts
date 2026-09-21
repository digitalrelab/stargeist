import { Module } from "@stargeist/application";
import { Clock, Context, Effect, Layer } from "effect";
import type { WorkspaceId } from "../workspaces";
import type { LibrarySource } from "./library";
import { LibraryRepository } from "./repository";

export class Libraries extends Context.Service<Libraries>()("@stargeist/domain/Libraries", {
  make: Effect.gen(function* () {
    const repository = yield* LibraryRepository;

    return {
      list: repository.list,
      get: repository.get,
      add: (workspaceId: WorkspaceId, source: typeof LibrarySource.Type, displayName: string) =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((now) => repository.add(workspaceId, source, displayName, now)),
        ),
    };
  }),
}) {}

export const LibrariesModule = Module.define({
  exports: Libraries,
  layer: Layer.effect(Libraries, Libraries.make),
});
