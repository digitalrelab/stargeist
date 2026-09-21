import type { LibrarySource } from "../libraries";
import { Module } from "@stargeist/application";
import { Clock, Context, Effect, Layer } from "effect";
import { WorkspaceRepository } from "./repository";

export class Workspaces extends Context.Service<Workspaces>()("@stargeist/domain/Workspaces", {
  make: Effect.gen(function* () {
    const repository = yield* WorkspaceRepository;

    return {
      list: repository.list,
      get: repository.get,
      create: (displayName: string, source: typeof LibrarySource.Type) =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((now) => repository.create(displayName, source, now)),
        ),
    };
  }),
}) {}

export const WorkspacesModule = Module.define({
  exports: Workspaces,
  layer: Layer.effect(Workspaces, Workspaces.make),
});
