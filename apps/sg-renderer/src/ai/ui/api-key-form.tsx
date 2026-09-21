import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button, typography } from "@stargeist/ui";
import { colors, control, focusRing, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useId, useState } from "react";
import { Redacted } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { OperationFeedback, operationDisabled } from "./operation";
import { useAIProviderConnectionsState } from "./use-state";

export function APIKeyForm({ providerId, onClose }: { providerId: string; onClose: () => void }) {
  const id = useId();
  const [key, setKey] = useState("");
  const operation = useAIProviderConnectionsState().operation(providerId);
  const result = useAtomValue(operation);
  const configure = useAtomSet(operation, { mode: "promiseExit" });
  const reset = useAtomSet(operation);
  const disabled = operationDisabled(result);

  const save = async () => {
    if (disabled || key.length === 0) return;
    const exit = await configure({
      type: "configure",
      credential: { kind: "apiKey", key: Redacted.make(key) },
    });
    if (exit._tag === "Success") onClose();
  };

  const cancel = () => {
    reset(Atom.Reset);
    onClose();
  };

  return (
    <form
      {...stylex.props(styles.form)}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label htmlFor={id} {...stylex.props(typography.label)}>
        API key
      </label>
      <input
        {...stylex.props(styles.input, typography.body)}
        id={id}
        type="password"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        required
        maxLength={4096}
        value={key}
        disabled={disabled}
        onChange={(event) => setKey(event.target.value)}
      />
      <div {...stylex.props(styles.actions)}>
        <Button type="submit" disabled={disabled || key.length === 0}>
          Save key
        </Button>
        <Button type="button" appearance="ghost" disabled={result.waiting} onClick={cancel}>
          Cancel
        </Button>
      </div>
      <OperationFeedback result={result} pending="Validating and saving…" />
    </form>
  );
}

const styles = stylex.create({
  form: { display: "flex", flexDirection: "column", gap: space[2] },
  input: {
    width: "100%",
    minWidth: 0,
    minHeight: control.heightMd,
    paddingBlock: space[2],
    paddingInline: space[3],
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: control.radius,
    backgroundColor: colors.surface,
    color: colors.text,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineColor: colors.focusRing,
    outlineWidth: focusRing.width,
    outlineOffset: focusRing.offset,
  },
  actions: { display: "flex", flexWrap: "wrap", gap: space[2], paddingTop: space[2] },
});
