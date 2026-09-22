import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
import type { Extent } from "../pagination";
import * as Membership from "./membership";
import { extendRange, type Range } from "./range";
import type { Command, Interaction, Operation, Position, Request, Source } from "./types";

interface State<A, Key, Scope> {
  readonly selection: Membership.Selection<Key, Scope>;
  readonly active: number | undefined;
  readonly current: Position<A> | undefined;
  readonly anchor: number | undefined;
  readonly range: Range<Key, Scope> | undefined;
}

export function create<A, Key, E, Scope>(
  source: Source<A, Key, E, Scope>,
  onInteraction?: Atom.Writable<unknown, Interaction<A, Key, Scope>>,
) {
  const state = Atom.make<State<A, Key, Scope>>({
    selection: Membership.empty<Key, Scope>(source.scope),
    active: undefined,
    current: undefined,
    anchor: undefined,
    range: undefined,
  });
  const intent = Atom.make<Request | undefined>(undefined);

  function commit(
    ctx: { set<R, W>(atom: Atom.Writable<R, W>, value: W): void },
    next: State<A, Key, Scope>,
    type: Interaction<A, Key, Scope>["type"],
  ) {
    Atom.batch(() => {
      ctx.set(state, next);

      if (onInteraction) {
        ctx.set(onInteraction, {
          type,
          focused: next.current,
          selection: next.selection,
        });
      }
    });
  }

  const request = Atom.fn((input: Request, get) =>
    Effect.gen(function* () {
      const before = get(state);
      const item = yield* source.read(input.index, input);

      if (item === undefined) {
        get.set(state, settle(before));

        return;
      }

      const position = { index: input.index, item };

      if (input.operation === "range") {
        const anchor = before.anchor ?? before.current?.index ?? input.index;
        const range = yield* extendRange(
          source.readRange,
          before.range,
          before.selection,
          anchor,
          input.index,
          input,
        );

        commit(
          get,
          {
            active: input.index,
            current: position,
            anchor,
            range,
            selection: range.selection,
          },
          "select",
        );

        return;
      }

      commit(
        get,
        focusPosition(before, position, input.operation),
        interactionType(input.operation),
      );
    }),
  ).pipe(Atom.setIdleTTL(0));

  function focusPosition(
    before: State<A, Key, Scope>,
    value: Position<A>,
    operation: Operation,
  ): State<A, Key, Scope> {
    let selection = before.selection;

    if (operation === "toggle") {
      selection = Membership.toggle(selection, source.keyOf(value));
    }

    return {
      selection,
      active: value.index,
      current: value,
      anchor: value.index,
      range: undefined,
    };
  }

  const command = Atom.writable(
    (get) => {
      get.mount(source.extent);
      get.mount(state);
      get.mount(intent);
      get.mount(request);

      if (onInteraction) {
        get.mount(onInteraction);
      }
    },
    (ctx, action: Command<A, Key>) => {
      const before = ctx.get(state);

      const cancel = () => {
        ctx.set(request, Atom.Reset);
        ctx.set(intent, undefined);
      };

      const replace = (selection: Membership.Selection<Key, Scope>) => {
        cancel();
        commit(ctx, { ...settle(before), selection }, "select");
      };

      const focus = (position: Position<A>, operation: Operation) => {
        cancel();
        commit(ctx, focusPosition(before, position, operation), interactionType(operation));
      };

      const resolve = (index: number, operation: Operation) => {
        const extent = ctx.get(source.extent);

        if (extent.count === 0 && !extent.hasMore) {
          return;
        }

        const target = clamp(index, extent);
        const previous = ctx.get(intent);
        const pending = ctx.get(request).waiting;

        if (pending && previous?.index === target && previous.operation === operation) {
          return;
        }

        if (
          !pending &&
          operation === "focus" &&
          before.current &&
          target === before.current.index &&
          target === before.active
        ) {
          return focus(before.current, "focus");
        }

        let anchor = before.anchor;
        let range = before.range;

        if (operation !== "range") {
          anchor = target;
          range = undefined;
        }

        const next = { index: target, operation, retry: false };

        ctx.set(request, Atom.Reset);
        ctx.set(state, { ...before, active: target, anchor, range });
        ctx.set(intent, next);
        ctx.set(request, next);
      };

      const navigate = (index: number, extend = false) => {
        if (extend) {
          resolve(index, "range");
        } else {
          resolve(index, "focus");
        }
      };

      const activateOrToggle = (operation: "activate" | "toggle", value?: Position<A>) => {
        if (value) {
          return focus(value, operation);
        }

        if (before.current && before.current.index === before.active) {
          return focus(before.current, operation);
        }

        resolve(before.active ?? 0, operation);
      };

      switch (action.type) {
        case "all":
          return replace(Membership.all(source.scope));

        case "clear":
          return replace(Membership.empty(source.scope));

        case "replace":
          return replace(Membership.replace(source.scope, action.keys));

        case "cancel":
          cancel();
          ctx.set(state, settle(before));
          return;

        case "focus":
          return focus(action.value, "focus");

        case "toggle":
          return activateOrToggle("toggle", action.value);

        case "activate":
          return activateOrToggle("activate", action.value);

        case "range":
          return resolve(action.index, "range");

        case "first":
          return navigate(0, action.extend);

        case "last":
          return navigate(ctx.get(source.extent).count - 1, action.extend);

        case "move": {
          if (before.active === undefined) {
            return navigate(0, action.extend);
          }

          return navigate(before.active + action.by, action.extend);
        }

        case "retry": {
          const previous = ctx.get(intent);

          if (previous) {
            ctx.set(request, { ...previous, retry: true });
          }

          return;
        }
      }
    },
  ).pipe(Atom.setIdleTTL(0));

  const selection = Atom.map(state, (value) => value.selection);

  return {
    active: Atom.map(state, (value) => value.active),
    current: Atom.map(state, (value) => value.current),
    selection,
    isSelected: Atom.family((key: Key) =>
      Atom.map(selection, (value) => Membership.contains(value, key)),
    ),
    operation: Atom.map(intent, (value) => value?.operation),
    request,
    command,
  };
}

function settle<A, Key, Scope>(state: State<A, Key, Scope>): State<A, Key, Scope> {
  return {
    ...state,
    active: state.current?.index,
    anchor: state.current?.index,
    range: undefined,
  };
}

function interactionType(operation: Operation): Interaction<unknown, unknown, unknown>["type"] {
  switch (operation) {
    case "focus":
    case "activate":
      return operation;

    case "range":
    case "toggle":
      return "select";
  }
}

function clamp(index: number, extent: Extent) {
  let last = extent.count - 1;

  if (extent.hasMore) {
    last = extent.count;
  }

  return Math.max(0, Math.min(index, last));
}

export type Controller<A, Key, E, Scope> = ReturnType<typeof create<A, Key, E, Scope>>;
