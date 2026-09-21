import { WorkspaceError } from "@stargeist/domain/workspaces";
import { Cause } from "effect";
import { RpcClientError } from "effect/unstable/rpc";
import { describe, expect, it } from "vite-plus/test";
import { ClientUnavailableError, canRetryFailure, failureMessage } from "./index";

describe("client failure messages", () => {
  it("presents RPC failures without exposing protocol diagnostics", () => {
    const cause = new Error("Private protocol diagnostic");
    const error = new RpcClientError.RpcClientError({
      reason: new RpcClientError.RpcClientDefect({
        message: "Malformed response from the backend",
        cause,
      }),
    });

    expect(failureMessage(Cause.fail(error))).toBe(
      "The connection is unavailable. Reopen Stargeist to reconnect.",
    );
    expect(error.reason.cause).toBe(cause);
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
