import { WorkspaceError } from "@stargeist/domain";
import { Cause } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { ClientUnavailableError, canRetryFailure, failureMessage } from "./index";

describe("client failure messages", () => {
  it("presents connection failures without exposing protocol diagnostics", () => {
    const cause = new Error("Private protocol diagnostic");
    const error = new ClientUnavailableError({
      message: "The connection is unavailable. Reopen Stargeist to reconnect.",
      cause,
    });

    expect(failureMessage(Cause.fail(error))).toBe(
      "The connection is unavailable. Reopen Stargeist to reconnect.",
    );
    expect(error.cause).toBe(cause);
    expect(canRetryFailure(Cause.fail(error))).toBe(false);
  });

  it("preserves actionable domain and startup messages", () => {
    const domain = new WorkspaceError({ code: "NotFound", message: "Workspace no longer exists." });
    const startup = new ClientUnavailableError({ message: "This client is unavailable." });

    expect(failureMessage(Cause.fail(domain))).toBe("Workspace no longer exists.");
    expect(failureMessage(Cause.fail(startup))).toBe("This client is unavailable.");
    expect(canRetryFailure(Cause.fail(startup))).toBe(false);
    expect(canRetryFailure(Cause.fail(domain))).toBe(true);
  });

  it("provides a fallback for failures without an error message", () => {
    expect(failureMessage(Cause.fail(undefined))).toBe("Something went wrong. Please try again.");
  });
});
