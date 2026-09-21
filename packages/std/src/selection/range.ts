import { Effect, HashMap } from "effect";
import * as Membership from "./membership";
import type { ReadOptions, Source } from "./types";

export interface Range<Key, Scope> {
  readonly from: number;
  readonly to: number;
  readonly keys: HashMap.HashMap<number, Key>;
  readonly baseline: Membership.Selection<Key, Scope>;
  readonly selection: Membership.Selection<Key, Scope>;
}

export const extendRange = Effect.fnUntraced(function* <Key, E, Scope>(
  read: Source<unknown, Key, E, unknown>["readRange"],
  previous: Range<Key, Scope> | undefined,
  initial: Membership.Selection<Key, Scope>,
  anchor: number,
  target: number,
  options: ReadOptions,
) {
  const from = Math.min(anchor, target);
  const to = Math.max(anchor, target);
  let keys = previous?.keys ?? HashMap.empty<number, Key>();
  const baseline = previous?.baseline ?? initial;
  let selection = previous?.selection ?? baseline;

  const remove = (start: number, end: number) => {
    for (let index = start; index <= end; index++) {
      const key = HashMap.getUnsafe(keys, index);
      keys = HashMap.remove(keys, index);
      selection = Membership.set(selection, key, Membership.contains(baseline, key));
    }
  };

  if (previous) {
    remove(previous.from, Math.min(from - 1, previous.to));
    remove(Math.max(to + 1, previous.from), previous.to);
  }

  for (const [start, end] of addedSegments(previous, from, to)) {
    const added = yield* read(start, end, options);

    if (added.length !== end - start + 1) {
      return yield* Effect.die(
        new Error("Selection range does not match the collection revision."),
      );
    }

    for (let offset = 0; offset < added.length; offset++) {
      const key = added[offset]!;
      keys = HashMap.set(keys, start + offset, key);
      selection = Membership.set(selection, key, true);
    }
  }

  return { from, to, keys, baseline, selection } satisfies Range<Key, Scope>;
});

function addedSegments<Key, Scope>(
  previous: Range<Key, Scope> | undefined,
  from: number,
  to: number,
) {
  const segments: Array<readonly [number, number]> = [];

  if (!previous || to < previous.from || from > previous.to) {
    return [[from, to] as const];
  }

  if (from < previous.from) {
    segments.push([from, previous.from - 1]);
  }

  if (to > previous.to) {
    segments.push([previous.to + 1, to]);
  }

  return segments;
}
