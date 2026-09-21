import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Atom } from "effect/unstable/reactivity";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { Controller, Interaction, Position } from "../index";

function useController<A, Key, E, Scope>(
  controller: Controller<A, Key, E, Scope>,
  options: {
    readonly onInteraction: (value: Interaction<A, Key, Scope>, element: HTMLElement) => void;
    readonly pageSize: (element: HTMLDivElement | null) => number;
  },
) {
  const active = useAtomValue(controller.active);
  const interaction = useAtomValue(controller.interaction);
  const request = useAtomValue(controller.request);
  const dispatch = useAtomSet(controller.command);
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const onInteraction = useEffectEvent(options.onInteraction);
  useEffect(() => {
    if (interaction && ref.current) onInteraction(interaction, ref.current);
  }, [interaction]);

  const focus = () => ref.current?.focus({ preventScroll: true });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.target !== event.currentTarget ||
      event.nativeEvent.isComposing ||
      event.altKey
    )
      return;
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() !== "a" || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) dispatch({ type: "all" });
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
          if (event.shiftKey) dispatch({ type: "range", index: active ?? 0 });
          else dispatch({ type: "toggle" });
        }
        break;
      case "Enter":
        if (event.shiftKey) return;
        if (!event.repeat) dispatch({ type: "activate" });
        break;
      case "Escape":
        if (event.shiftKey) return;
        if (request.waiting || request._tag === "Failure") dispatch({ type: "cancel" });
        else dispatch({ type: "clear" });
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
    focus,
    focused,
    activate: (value: Position<A>) => {
      dispatch({ type: "activate", value });
      focus();
    },
    toggle: (value: Position<A>) => {
      dispatch({ type: "toggle", value });
      focus();
    },
    extend: (index: number) => {
      dispatch({ type: "range", index });
      focus();
    },
    clear: () => {
      dispatch({ type: "clear" });
      focus();
    },
    cancel: () => {
      dispatch({ type: "cancel" });
      focus();
    },
    itemProps: {
      onMouseDown: (event: MouseEvent<HTMLElement>) => {
        if (event.button === 0) event.preventDefault();
      },
    },
    props: {
      ref,
      tabIndex: 0,
      onKeyDown,
      onFocus: (event: FocusEvent<HTMLDivElement>) => {
        setFocused(event.target === event.currentTarget);
      },
      onBlur: () => setFocused(false),
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
