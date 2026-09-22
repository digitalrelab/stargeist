import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button, ErrorIcon, Field, Form, Tooltip } from "@stargeist/ui";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useId, useRef, useState } from "react";
import { Redacted } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { failureMessage } from "#src/client/index.ts";
import { useAIProviderConnectionsState } from "./use-state";

export function APIKeyForm({
  providerId,
  placeholder,
  onClose,
}: {
  providerId: string;
  placeholder?: string | undefined;
  onClose: () => void;
}) {
  const [key, setKey] = useState("");
  const operation = useAIProviderConnectionsState().operation(providerId);
  const result = useAtomValue(operation);
  const configure = useAtomSet(operation, { mode: "promiseExit" });
  const reset = useAtomSet(operation);
  const saving = useRef(false);
  let operationError: string | undefined;

  if (result._tag === "Failure") operationError = failureMessage(result.cause);

  const close = () => {
    reset(Atom.Reset);
    onClose();
  };

  const save = async () => {
    if (saving.current || key.length === 0) return;
    saving.current = true;
    try {
      const exit = await configure({
        type: "configure",
        credential: { kind: "apiKey", key: Redacted.make(key) },
      });
      if (exit._tag === "Success") close();
    } finally {
      saving.current = false;
    }
  };

  const updateKey = (value: string) => {
    if (result._tag === "Failure") reset(Atom.Reset);
    setKey(value);
  };

  return (
    <Form.Root onFormSubmit={() => void save()}>
      <Field.Root name="apiKey" invalid={operationError !== undefined}>
        <Field.Label>API key</Field.Label>
        <Field.Validity>
          {(validity) => (
            <APIKeyControl
              error={operationError}
              fieldError={validity.error}
              placeholder={placeholder}
              readOnly={result.waiting}
              value={key}
              valueMissing={validity.validity.valueMissing}
              onValueChange={updateKey}
            />
          )}
        </Field.Validity>
      </Field.Root>
      <div {...stylex.props(styles.actions)}>
        <Button type="button" appearance="ghost" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" aria-busy={result.waiting}>
          Save
        </Button>
      </div>
    </Form.Root>
  );
}

function APIKeyControl({
  error: operationError,
  fieldError,
  placeholder,
  readOnly,
  value,
  valueMissing,
  onValueChange,
}: {
  error: string | undefined;
  fieldError: string;
  placeholder: string | undefined;
  readOnly: boolean;
  value: string;
  valueMissing: boolean;
  onValueChange: (value: string) => void;
}) {
  let error = operationError;
  if (error === undefined && valueMissing) error = "Enter an API key.";
  if (error === undefined && fieldError.length > 0) error = fieldError;

  return (
    <>
      <Field.ControlGroup>
        <Field.Control
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          maxLength={4096}
          placeholder={placeholder}
          readOnly={readOnly}
          value={value}
          onValueChange={onValueChange}
        />
        {error !== undefined && (
          <Field.Suffix>
            <FieldErrorTooltip message={error} />
          </Field.Suffix>
        )}
      </Field.ControlGroup>
      {error !== undefined && (
        <Field.Error match visuallyHidden>
          {error}
        </Field.Error>
      )}
    </>
  );
}

function FieldErrorTooltip({ message }: { message: string }) {
  const triggerId = useId();

  return (
    <Tooltip.Root defaultOpen defaultTriggerId={triggerId}>
      <Tooltip.Trigger
        id={triggerId}
        delay={100}
        aria-label={message}
        render={<Button type="button" appearance="dangerGhost" shape="square" size="xs" />}
      >
        <ErrorIcon aria-hidden="true" />
      </Tooltip.Trigger>
      <Tooltip.Popup>{message}</Tooltip.Popup>
    </Tooltip.Root>
  );
}

const styles = stylex.create({
  actions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: space[2],
    paddingTop: space[2],
  },
});
