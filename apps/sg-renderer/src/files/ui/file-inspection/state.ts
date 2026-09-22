import type { File, WorkspaceId, ListingId } from "@stargeist/domain";
import { Selection } from "@stargeist/std/selection";
import { Effect, HashSet } from "effect";
import { AsyncResult, Atom, type AtomRegistry } from "effect/unstable/reactivity";
import type { FileInteraction, FileSelection } from "../../selection";
import type { FileListing } from "../../state";

type ReadFile = (
  index: number,
) => Effect.Effect<File | undefined, unknown, AtomRegistry.AtomRegistry>;

export interface FileInspection {
  readonly selection: FileSelection;
  readonly total: number | undefined;
  readonly file: File | undefined;
  readonly index: number | undefined;
  readonly read: ReadFile;
}

export interface FileInspectionInput {
  readonly interaction: FileInteraction;
  readonly workspaceId: WorkspaceId;
  readonly folder: string | undefined;
  readonly extent: FileListing["extent"];
  readonly read: ReadFile;
}

type Command =
  | { readonly type: "interact"; readonly input: FileInspectionInput }
  | { readonly type: "cancel" };

function resolveInspection(
  input: FileInspectionInput,
  total: number | undefined,
): FileInspection | undefined {
  const { interaction, workspaceId, folder } = input;
  const focused = interaction.focused;
  let members = interaction.selection;

  if (interaction.type !== "select") {
    if (!focused) {
      return undefined;
    }

    members = Selection.replace(members.scope, [focused.index]);
  }

  const count = Selection.count(members, total);
  if (count === 0) return undefined;

  let index;
  if (count === 1) {
    if (members.mode === "explicit") index = members.keys[Symbol.iterator]().next().value;
    else if (focused && Selection.contains(members, focused.index)) index = focused.index;
    else if (total !== undefined) {
      for (let position = 0; position < total; position++) {
        if (Selection.contains(members, position)) {
          index = position;
          break;
        }
      }
    }
  }

  let file;
  if (focused && focused.index === index) file = focused.item;

  return {
    selection: { workspaceId, folder, members },
    total,
    file,
    index,
    read: input.read,
  };
}

export function createFileInspection() {
  const input = Atom.make<FileInspectionInput | undefined>(undefined);
  const target = Atom.make((get) => {
    const current = get(input);
    if (!current) return undefined;
    const extent = get(current.extent);
    let total;
    if (!extent.hasMore) total = extent.count;
    return resolveInspection(current, total);
  });
  const detail = Atom.make((get) => {
    const current = get(target);
    if (!current || current.index === undefined) return Effect.succeed(undefined);
    if (current.file) return Effect.succeed(current.file);
    return current.read(current.index);
  }).pipe(Atom.setIdleTTL(0));
  const navigate = Atom.fn((next: FileInspectionInput, get) =>
    Effect.gen(function* () {
      yield* Effect.sleep(250);
      get.set(input, next);
    }),
  ).pipe(Atom.setLazy(false), Atom.setIdleTTL(0));

  const command = Atom.writable(
    (get) => {
      get.mount(target);
      get.mount(navigate);
    },
    (ctx, action: Command) => {
      switch (action.type) {
        case "interact": {
          if (action.input.interaction.type === "focus") {
            ctx.set(navigate, action.input);
          } else {
            ctx.set(navigate, Atom.Reset);
            ctx.set(input, action.input);
          }

          return;
        }

        case "cancel":
          ctx.set(navigate, Atom.Reset);
          return;
      }
    },
  ).pipe(Atom.setIdleTTL(0));

  function bind(listing: FileListing, location: Pick<FileSelection, "workspaceId" | "folder">) {
    return Atom.writable(
      () => undefined,
      (ctx, interaction: FileInteraction) => {
        ctx.set(command, {
          type: "interact",
          input: {
            interaction,
            ...location,
            extent: listing.extent,
            read: (index) =>
              listing.read(listing.pageOffset(index), { retry: true }).pipe(
                Effect.map((page) => page.items[index - listing.pageOffset(index)]),
                Effect.scoped,
              ),
          },
        });
      },
    );
  }

  return {
    target: Atom.readable((get) => {
      const current = get(target);
      if (!current || current.file || current.index === undefined) return current;
      const result = get(detail);
      if (AsyncResult.isSuccess(result) && !result.waiting)
        return { ...current, file: result.value };
      return current;
    }),
    detail,
    inspectedIndex: Atom.family((scope: ListingId) =>
      Atom.map(target, (value) => {
        if (!value || value.selection.members.scope !== scope) {
          return undefined;
        }

        return value.index;
      }),
    ),
    command,
    bind,
  };
}

export function describeFileInspection(target: FileInspection) {
  const { members } = target.selection;
  const count = Selection.count(members, target.total);
  if (target.file) {
    return { type: "file" as const, name: target.file.name, id: target.file.id };
  }

  if (count !== undefined) {
    let label = `${count.toLocaleString()} files selected`;

    if (count === 1) {
      label = "1 file selected";
    }

    return { type: "selection" as const, label };
  }

  let label = "All files selected";

  if (members.mode === "all") {
    const excluded = HashSet.size(members.excludedKeys);

    if (excluded > 0) {
      label += ` except ${excluded.toLocaleString()}`;
    }
  }

  return { type: "selection" as const, label };
}
