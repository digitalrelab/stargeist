import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Atom } from "effect/unstable/reactivity";
import {
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { Command, Controller, Interaction } from "../index";

function useController<A, Key, E, Scope>(
  controller: Controller<A, Key, E, Scope>,
  options: {
    readonly onInteraction: (value: Interaction<A, Key, Scope>, element: HTMLElement) => void;
    readonly pageSize: (element: HTMLDivElement | null) => number;
  },
) {
  const active = useAtomValue(controller.active);
  const request = useAtomValue(controller.request);
  const send = useAtomSet(controller.command);
  const ref = useRef<HTMLDivElement>(null);
  const registry = useContext(RegistryContext);

  const onInteraction = useEffectEvent(options.onInteraction);
  useEffect(() => {
    registry.get(controller.interaction);

    return registry.subscribe(controller.interaction, (interaction) => {
      if (interaction && ref.current) {
        onInteraction(interaction, ref.current);
      }
    });
  }, [controller.interaction, registry]);

  const dispatch = (command: Command<A, Key>) => {
    send(command);
    ref.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.target !== event.currentTarget ||
      event.nativeEvent.isComposing ||
      event.altKey
    ) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() !== "a" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!event.repeat) {
        dispatch({ type: "all" });
      }

      return;
    }

    switch (event.key) {
      case "ArrowDown":
        dispatch({ type: "move", by: 1, extend: event.shiftKey });
        break;

      case "ArrowUp":
        dispatch({ type: "move", by: -1, extend: event.shiftKey });
        break;

      case "Home":
        dispatch({ type: "first", extend: event.shiftKey });
        break;

      case "End":
        dispatch({ type: "last", extend: event.shiftKey });
        break;

      case "PageDown":
        dispatch({
          type: "move",
          by: Math.max(1, options.pageSize(ref.current)),
          extend: event.shiftKey,
        });
        break;

      case "PageUp":
        dispatch({
          type: "move",
          by: -Math.max(1, options.pageSize(ref.current)),
          extend: event.shiftKey,
        });
        break;

      case " ":
        if (!event.repeat) {
          if (event.shiftKey) {
            dispatch({ type: "range", index: active ?? 0 });
          } else {
            dispatch({ type: "toggle" });
          }
        }
        break;

      case "Enter":
        if (event.shiftKey) {
          return;
        }
        if (!event.repeat) {
          dispatch({ type: "activate" });
        }
        break;

      case "Escape":
        if (event.shiftKey) {
          return;
        }
        if (request.waiting || request._tag === "Failure") {
          dispatch({ type: "cancel" });
        } else {
          dispatch({ type: "clear" });
        }
        break;

      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  return {
    active,
    request,
    dispatch,
    itemProps: {
      onMouseDown: (event: MouseEvent<HTMLElement>) => {
        if (event.button === 0) {
          event.preventDefault();
        }
      },
    },
    props: {
      ref,
      tabIndex: 0,
      onKeyDown,
    },
  };
}

function useSelected<Key>(
  controller: { readonly isSelected: (key: Key) => Atom.Atom<boolean> },
  key: Key,
) {
  return useAtomValue(controller.isSelected(key));
}

export const Selection = { useController, useSelected };
