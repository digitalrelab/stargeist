import { typography } from "@stargeist/ui";
import { colors } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { AsyncResult } from "effect/unstable/reactivity";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import type { ConnectionAction } from "../state";

type OperationResult = AsyncResult.AsyncResult<ConnectionAction["type"], unknown>;

export function operationDisabled(result: OperationResult) {
  if (result.waiting) return true;
  if (result._tag === "Failure") return !canRetryFailure(result.cause);
  return false;
}

export function OperationFeedback({
  result,
  pending,
}: {
  result: OperationResult;
  pending: string;
}) {
  if (result.waiting)
    return (
      <p role="status" {...stylex.props(styles.feedback, typography.label)}>
        {pending}
      </p>
    );
  if (result._tag === "Failure")
    return (
      <p role="alert" {...stylex.props(styles.feedback, typography.label)}>
        {failureMessage(result.cause)}
      </p>
    );
  if (result._tag === "Success" && result.value === "check")
    return (
      <p role="status" {...stylex.props(styles.feedback, typography.label)}>
        Key checked.
      </p>
    );
  return <p role="status" {...stylex.props(styles.feedback, typography.label)} />;
}

const styles = stylex.create({
  feedback: { minHeight: "1.5em", color: colors.textMuted, overflowWrap: "anywhere" },
});
