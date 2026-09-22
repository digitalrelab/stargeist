import { useAtomValue } from "@effect/atom-react";
import type { Atom } from "effect/unstable/reactivity";

function useSelected<Key>(
  controller: { readonly isSelected: (key: Key) => Atom.Atom<boolean> },
  key: Key,
) {
  return useAtomValue(controller.isSelected(key));
}

export const Selection = { useSelected };
