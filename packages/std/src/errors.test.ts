import { Cause, Effect, Logger, References } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { reportFailure } from "./errors";

describe("failure reporting", () => {
  it("does not report cancellation as an error", () => {
    const messages: unknown[] = [];
    const logger = Logger.make(({ message }) => messages.push(message));

    Effect.runSync(
      reportFailure("load", Cause.interrupt()).pipe(Effect.provide(Logger.layer([logger]))),
    );

    expect(messages).toEqual([]);
  });

  it("preserves a defect when cancellation is also present", () => {
    const defect = new Error("Window failed");
    const cause = Cause.combine(Cause.die(defect), Cause.interrupt());
    const entries: Array<{ cause: Cause.Cause<unknown>; operation: unknown; level: string }> = [];
    const logger = Logger.make(({ cause, fiber, logLevel }) => {
      entries.push({
        cause,
        operation: fiber.getRef(References.CurrentLogAnnotations).operation,
        level: logLevel,
      });
    });

    Effect.runSync(
      reportFailure("desktop.window", cause).pipe(Effect.provide(Logger.layer([logger]))),
    );

    expect(entries).toEqual([{ cause, operation: "desktop.window", level: "Error" }]);
  });
});
