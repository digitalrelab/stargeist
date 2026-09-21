import { HashSet } from "effect";

export type Selection<Key, Scope = string> =
  | { readonly scope: Scope; readonly mode: "explicit"; readonly keys: HashSet.HashSet<Key> }
  | { readonly scope: Scope; readonly mode: "all"; readonly excludedKeys: HashSet.HashSet<Key> };

export const empty = <Key, Scope>(scope: Scope): Selection<Key, Scope> => ({
  scope,
  mode: "explicit",
  keys: HashSet.empty<Key>(),
});

export const all = <Key, Scope>(scope: Scope): Selection<Key, Scope> => ({
  scope,
  mode: "all",
  excludedKeys: HashSet.empty<Key>(),
});

export const replace = <Key, Scope>(scope: Scope, keys: Iterable<Key>): Selection<Key, Scope> => ({
  scope,
  mode: "explicit",
  keys: HashSet.fromIterable(keys),
});

export function contains<Key, Scope>(selection: Selection<Key, Scope>, key: Key): boolean {
  if (selection.mode === "all") {
    return !HashSet.has(selection.excludedKeys, key);
  }

  return HashSet.has(selection.keys, key);
}

export function set<Key, Scope>(
  selection: Selection<Key, Scope>,
  key: Key,
  selected: boolean,
): Selection<Key, Scope> {
  if (contains(selection, key) === selected) {
    return selection;
  }

  if (selection.mode === "all") {
    if (selected) {
      return { ...selection, excludedKeys: HashSet.remove(selection.excludedKeys, key) };
    }

    return { ...selection, excludedKeys: HashSet.add(selection.excludedKeys, key) };
  }

  if (selected) {
    return { ...selection, keys: HashSet.add(selection.keys, key) };
  }

  return { ...selection, keys: HashSet.remove(selection.keys, key) };
}

export function toggle<Key, Scope>(
  selection: Selection<Key, Scope>,
  key: Key,
): Selection<Key, Scope> {
  return set(selection, key, !contains(selection, key));
}

export function count<Key, Scope>(
  selection: Selection<Key, Scope>,
  total?: number,
): number | undefined {
  if (selection.mode === "explicit") {
    return HashSet.size(selection.keys);
  }

  if (total !== undefined) {
    return Math.max(0, total - HashSet.size(selection.excludedKeys));
  }

  return undefined;
}
