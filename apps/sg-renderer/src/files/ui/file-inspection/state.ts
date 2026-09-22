import type { FileSystemEntry, LibraryId, ListingId } from "@stargeist/domain";
import { Selection } from "@stargeist/std/selection";
import { Effect, HashSet } from "effect";
import { Atom } from "effect/unstable/reactivity";
import type { FileInteraction, FileSelection } from "../../selection";

export interface FileInspection {
  readonly files: FileSelection;
  readonly total: number | undefined;
  readonly entry: FileSystemEntry | undefined;
}

export interface FileInspectionInput {
  readonly interaction: FileInteraction;
  readonly libraryId: LibraryId;
  readonly folder: string | undefined;
  readonly total: number | undefined;
}

type Command =
  | { readonly type: "interact"; readonly input: FileInspectionInput }
  | { readonly type: "close" | "cancel" };

function resolveInspection(input: FileInspectionInput): FileInspection | undefined {
  const { interaction, libraryId, folder, total } = input;
  const entry = interaction.focused?.item;
  let members = interaction.selection;

  if (interaction.type === "select") {
    if (Selection.count(members, total) === 0) {
      return undefined;
    }
  } else {
    if (!entry) {
      return undefined;
    }

    members = Selection.replace(members.scope, [entry.name]);
  }

  let detail;

  if (entry && Selection.count(members, total) === 1 && Selection.contains(members, entry.name)) {
    detail = entry;
  }

  return { files: { libraryId, folder, members }, total, entry: detail };
}

export function createFileInspection() {
  const target = Atom.make<FileInspection | undefined>(undefined);
  const navigate = Atom.fn((input: FileInspectionInput, get) =>
    Effect.gen(function* () {
      yield* Effect.sleep(250);
      get.set(target, resolveInspection(input));
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
            ctx.set(target, resolveInspection(action.input));
          }

          return;
        }

        case "close":
          ctx.set(navigate, Atom.Reset);
          ctx.set(target, undefined);
          return;

        case "cancel":
          ctx.set(navigate, Atom.Reset);
          return;
      }
    },
  ).pipe(Atom.setIdleTTL(0));

  return {
    target: Atom.readable((get) => get(target)),
    isOpen: Atom.map(target, (value) => value !== undefined),
    inspectedName: Atom.family((scope: ListingId) =>
      Atom.map(target, (value) => {
        if (!value || value.files.members.scope !== scope) {
          return undefined;
        }

        return singleFileName(value);
      }),
    ),
    command,
  };
}

export function describeFileInspection(target: FileInspection) {
  const { members } = target.files;
  const count = Selection.count(members, target.total);
  const name = singleFileName(target);

  if (name !== undefined) {
    return { type: "file" as const, name, kind: target.entry?.kind };
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

function singleFileName(target: FileInspection): string | undefined {
  const { members } = target.files;

  if (Selection.count(members, target.total) !== 1) {
    return undefined;
  }

  if (members.mode === "explicit") {
    return members.keys[Symbol.iterator]().next().value;
  }

  return target.entry?.name;
}
