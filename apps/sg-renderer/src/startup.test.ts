import { Cause, Effect, Logger } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { expect, it, onTestFinished, vi } from "vite-plus/test";
import { startRenderer } from "./startup";

vi.mock("./router", () => {
  throw new ReferenceError("Route component is not defined");
});

it("exposes a route import failure through startup state instead of rejecting the entry module", async () => {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  const startup = Atom.make(startRenderer(registry).pipe(Effect.provide(Logger.layer([]))));

  await Effect.runPromiseExit(AtomRegistry.getResult(registry, startup));
  const result = registry.get(startup);

  expect(result._tag).toBe("Failure");
  if (result._tag !== "Failure") throw new Error("Expected a visible startup failure.");
  expect(Cause.hasDies(result.cause)).toBe(true);
  expect(Cause.pretty(result.cause)).toContain("Route component is not defined");
});
