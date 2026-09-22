import {
  Workspace,
  WorkspaceError,
  makeWorkspaceId,
  type WorkspaceId,
  type Workspaces,
} from "@stargeist/domain";
import type { WorkspaceStore, WorkspaceStorage, WorkspaceMetadata } from "@stargeist/storage";
import { Effect } from "effect";

const workspace = ({ id, root }: Pick<Workspace, "id" | "root">) => new Workspace({ id, root });
const notFound = () =>
  new WorkspaceError({
    code: "NotFound",
    message: "This workspace is no longer remembered. Open its folder again.",
  });

export function makeWorkspaces(
  storage: typeof WorkspaceStorage,
  store: WorkspaceStore,
): Workspaces["Service"] {
  const remember = (root: WorkspaceMetadata) =>
    store.modify((records) =>
      Effect.gen(function* () {
        const existing = yield* records.atRoot(root.root);
        if (existing?.identity === root.identity) return workspace(existing);
        if (existing) yield* records.remove(existing.id);
        const record = { id: yield* makeWorkspaceId, identity: root.identity, root: root.root };
        yield* records.put(record);
        return workspace(record);
      }),
    );

  return {
    list: store.list.pipe(Effect.map((records) => records.map(workspace))),
    get: Effect.fnUntraced(function* (id) {
      const record = yield* store.get(id);
      if (!record) return yield* notFound();
      const root = yield* storage.at(record.root).read;
      if (root.identity !== record.identity) {
        return yield* new WorkspaceError({
          code: "WorkspaceChanged",
          message:
            "A different workspace is now in this folder. Open it again or locate the original workspace.",
        });
      }
      return workspace(record);
    }),
    open: Effect.fnUntraced(function* (path) {
      let root = yield* storage.discover(path);
      if (!root) root = yield* storage.at(path).initialize;
      return yield* remember(root);
    }),
    initialize: Effect.fnUntraced(function* (path) {
      return yield* remember(yield* storage.at(path).initialize);
    }),
    reconnect: Effect.fnUntraced(function* (id: WorkspaceId, path) {
      const root = yield* storage.discover(path);
      if (!root)
        return yield* new WorkspaceError({
          code: "NotFound",
          message: "No workspace was found in this folder. Choose the original workspace folder.",
        });
      return yield* store.modify((records) =>
        Effect.gen(function* () {
          const current = yield* records.get(id);
          if (!current) return yield* notFound();
          if (current.identity !== root.identity)
            return yield* new WorkspaceError({
              code: "WorkspaceChanged",
              message:
                "This folder belongs to a different workspace. Choose the original workspace folder.",
            });
          const occupied = yield* records.atRoot(root.root);
          if (occupied && occupied.id !== id)
            return yield* new WorkspaceError({
              code: "RootConflict",
              message: "This folder is already in your workspace list. Open it from there.",
            });
          yield* records.relocate(current, root.root);
          return workspace({ ...current, root: root.root });
        }),
      );
    }),
    forget: (id) => store.modify((records) => records.remove(id)),
  };
}
