import type { Effect, Scope } from "effect";
import type { Atom, AtomRegistry } from "effect/unstable/reactivity";
import type { Extent } from "../pagination";
import type { Selection } from "./membership";

export interface Interaction<A, Key, Scope> {
  readonly type: "focus" | "select" | "activate";
  readonly focused: Position<A> | undefined;
  readonly selection: Selection<Key, Scope>;
}

export interface Position<A> {
  readonly index: number;
  readonly item: A;
}

type ReadEffect<A, E> = Effect.Effect<A, E, AtomRegistry.AtomRegistry | Scope.Scope>;

export interface ReadOptions {
  readonly refresh: boolean;
}

export interface Source<A, Key, E, CollectionScope> {
  readonly scope: CollectionScope;
  readonly extent: Atom.Atom<Extent>;
  readonly keyOf: (item: A) => Key;
  readonly read: (index: number, options: ReadOptions) => ReadEffect<A | undefined, E>;
  readonly readRange: (
    from: number,
    to: number,
    options: ReadOptions,
  ) => ReadEffect<ReadonlyArray<Key>, E>;
}

export type Command<A, Key> =
  | { readonly type: "focus"; readonly value: Position<A> }
  | { readonly type: "move"; readonly by: number; readonly extend?: boolean }
  | { readonly type: "first" | "last"; readonly extend?: boolean }
  | { readonly type: "range"; readonly index: number }
  | { readonly type: "toggle" | "activate"; readonly value?: Position<A> }
  | { readonly type: "replace"; readonly keys: Iterable<Key> }
  | { readonly type: "all" | "clear" | "cancel" | "retry" };

export type Operation = "focus" | "toggle" | "activate" | "range";
export interface Request extends ReadOptions {
  readonly index: number;
  readonly operation: Operation;
}
