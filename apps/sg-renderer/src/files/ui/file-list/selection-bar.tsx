import { useAtomValue } from "@effect/atom-react";
import { Selection } from "@stargeist/std/selection";
import { Button, CloseIcon, CommandIcon, SelectionBar } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { HashSet } from "effect";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import { useFileListContext } from "./context";

export function FileSelectionBar() {
  const list = useFileListContext();
  const extent = useAtomValue(list.listing.extent);
  const selection = useAtomValue(list.selection.selection);
  const request = useAtomValue(list.selection.request);
  const operation = useAtomValue(list.selection.operation);
  let total: number | undefined;

  if (!extent.hasMore) {
    total = extent.count;
  }

  const count = Selection.count(selection, total);
  let hasSelection = selection.mode === "all";
  let label = "All selected";

  if (count !== undefined) {
    hasSelection = count > 0;
    label = `${count.toLocaleString()} selected`;
  } else if (selection.mode === "all") {
    const excluded = HashSet.size(selection.excludedKeys);

    if (excluded > 0) {
      label = `All selected except ${excluded.toLocaleString()}`;
    }
  }

  const selecting = request.waiting && operation === "range";
  const failed = request._tag === "Failure";

  if (selecting) {
    label = "Selecting range…";
  }

  return (
    <SelectionBar.Root
      open={hasSelection || selecting || failed}
      aria-label="File selection"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (request.waiting || failed) {
          list.cancel();
        } else {
          list.clear();
        }
      }}
    >
      <SelectionBar.Status>{label}</SelectionBar.Status>
      <Button appearance="soft" size="sm" shape="pill" disabled={!hasSelection}>
        <CommandIcon aria-hidden="true" />
        Actions
      </Button>
      {selecting && (
        <Button appearance="ghost" size="sm" shape="pill" onClick={list.cancel}>
          Cancel
        </Button>
      )}
      <Button
        appearance="ghost"
        size="icon"
        shape="pill"
        aria-label="Clear selection"
        onClick={list.clear}
      >
        <CloseIcon aria-hidden="true" />
      </Button>
      {request._tag === "Failure" && (
        <div {...stylex.props(styles.failure)}>
          <p role="alert" {...stylex.props(styles.message)}>
            {failureMessage(request.cause)}
          </p>
          {canRetryFailure(request.cause) && (
            <Button
              appearance="soft"
              size="sm"
              shape="pill"
              onClick={list.retry}
              disabled={request.waiting}
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </SelectionBar.Root>
  );
}

const styles = stylex.create({
  failure: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    flexBasis: "100%",
    gap: space[2],
    paddingInline: space[3],
    paddingBlockEnd: space[1],
  },
  message: { flexGrow: 1, minWidth: 0, overflowWrap: "anywhere", color: colors.textMuted },
});
