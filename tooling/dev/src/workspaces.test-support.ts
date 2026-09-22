import { join } from "node:path";
import { databaseLayer } from "@stargeist/database";
import { makeWorkspaceStore } from "@stargeist/database/workspaces";
import { makeWorkspaceId } from "@stargeist/domain";
import { Effect } from "effect";
import type { DevelopmentProfile } from "./desktop/index";

export function rememberWorkspaces(profile: DevelopmentProfile, roots: ReadonlyArray<string>) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* makeWorkspaceStore;
      for (const root of roots) {
        const id = yield* makeWorkspaceId;
        yield* store.modify((records) => records.put({ id, identity: id, root }));
      }
    }).pipe(Effect.provide(databaseLayer(join(profile.data, "application.sqlite")))),
  );
}
