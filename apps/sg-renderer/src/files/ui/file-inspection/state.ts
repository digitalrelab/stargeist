import type { FileSystemEntry, LibraryId } from "@stargeist/domain";
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
  const selected = interaction.selection;
  let members = selected;
  const empty = Selection.count(selected, total) === 0;
  const inspectingFile = interaction.type !== "select" || empty;
  if (inspectingFile) {
    if (!entry) return undefined;
    members = Selection.replace(selected.scope, [entry.name]);
  }
  let detail;
  if (entry && Selection.count(members, total) === 1 && Selection.contains(members, entry.name)) {
    detail = entry;
  }
  return { files: { libraryId, folder, members }, total, entry: detail };
}

export function createFileInspection() {
  const target = Atom.make<FileInspection | undefined>(undefined);
  const navigate = Atom.fn((next: FileInspection | undefined, get) =>
    Effect.gen(function* () {
      yield* Effect.sleep(250);
      get.set(target, next);
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
          const next = resolveInspection(action.input);
          if (action.input.interaction.type === "focus") ctx.set(navigate, next);
          else {
            ctx.set(navigate, Atom.Reset);
            ctx.set(target, next);
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
    command,
  };
}

export function describeFileInspection(target: FileInspection) {
  const { members } = target.files;
  const count = Selection.count(members, target.total);
  if (count === 1) {
    let name = target.entry?.name;
    if (members.mode === "explicit") name = members.keys[Symbol.iterator]().next().value;
    if (name) return { type: "file" as const, name, kind: target.entry?.kind };
  }
  if (count !== undefined) {
    let label = `${count.toLocaleString()} files selected`;
    if (count === 1) label = "1 file selected";
    return { type: "selection" as const, label };
  }
  let label = "All files selected";
  if (members.mode === "all") {
    const excluded = HashSet.size(members.excludedKeys);
    if (excluded > 0) label += ` except ${excluded.toLocaleString()}`;
  }
  return { type: "selection" as const, label };
}
