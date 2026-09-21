import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Application, Module } from "@stargeist/application";
import { sqliteLayer } from "@stargeist/database";
import { librariesLayer } from "@stargeist/database/libraries";
import { workspacesLayer } from "@stargeist/database/workspaces";
import { Libraries, Workspaces } from "@stargeist/domain";
import { Effect, Layer } from "effect";
import { StoragePaths } from "../storage";

const database = Layer.unwrap(
  Effect.gen(function* () {
    const { database } = yield* StoragePaths;
    yield* Effect.promise(() => mkdir(dirname(database), { recursive: true }));
    return sqliteLayer({ filename: database });
  }),
);

export const BackendApplication = Application.define({
  modules: {
    workspaces: Module.define({ exports: Workspaces, layer: workspacesLayer }),
    libraries: Module.define({ exports: Libraries, layer: librariesLayer }),
  },
  provide: database,
});
