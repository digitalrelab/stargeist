import { Module } from "@stargeist/application";
import { Clock, Context, Effect, Layer } from "effect";
import { WorkspaceRepository, type SelectedFolder } from "./repository";

export class Workspaces extends Context.Service<Workspaces>()("@stargeist/domain/Workspaces", {
  make: Effect.gen(function* () {
    const repository = yield* WorkspaceRepository;

    return {
      list: repository.list,
      get: repository.get,
      register: (folder: SelectedFolder) =>
        Clock.currentTimeMillis.pipe(Effect.flatMap((now) => repository.register(folder, now))),
    };
  }),
}) {}

export const WorkspacesModule = Module.define({
  exports: Workspaces,
  layer: Layer.effect(Workspaces, Workspaces.make),
});
