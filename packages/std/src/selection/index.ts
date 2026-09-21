import { create } from "./controller";
import { empty, all, replace, contains, set, toggle, count } from "./membership";

export const Selection = { create, empty, all, replace, contains, set, toggle, count };
export type { Controller } from "./controller";
export type { Selection as SelectionState } from "./membership";
export type { Command, Interaction, Position, Source } from "./types";
