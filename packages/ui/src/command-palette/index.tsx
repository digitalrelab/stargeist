import { Autocomplete } from "@base-ui/react/autocomplete";
import * as stylex from "@stylexjs/stylex";
import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import * as Dialog from "../dialog";
import { ScrollArea } from "../scroll-area";
import { colors, control, fonts, radii, space } from "../tokens.stylex";
import { typography } from "../typography";

export interface ActionDetails {
  close: () => void;
}

export interface Action {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly keywords?: readonly string[];
  readonly disabled?: boolean;
  readonly onSelect: (details: ActionDetails) => void;
}

interface RootProps {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}

interface PopupProps {
  label: string;
  contextLabel: string;
  actions: readonly Action[];
  status?: string;
}

const PaletteContext = createContext<{
  query: string;
  setQuery: (query: string) => void;
  close: () => void;
} | null>(null);

export function Root({ children, onOpenChange }: RootProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) setQuery("");
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <PaletteContext value={{ query, setQuery, close: () => changeOpen(false) }}>
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        {children}
      </Dialog.Root>
    </PaletteContext>
  );
}

export { Trigger } from "../dialog";

export function Popup({ label, contextLabel, actions, status = "" }: PopupProps) {
  const context = useContext(PaletteContext);
  const input = useRef<HTMLInputElement>(null);
  const contextId = useId();
  const instructionsId = useId();
  const { contains } = Autocomplete.useFilter();

  if (!context) throw new Error("CommandPalette.Popup must be inside CommandPalette.Root.");

  const { query, setQuery, close } = context;

  return (
    <Dialog.Popup
      layout="command"
      aria-label={label}
      aria-describedby={contextId}
      initialFocus={input}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
    >
      <Autocomplete.Root
        open
        inline
        items={actions}
        itemToStringValue={(action) => action.label}
        filter={(action, search) => {
          if (contains(action.label, search)) return true;
          return action.keywords?.some((keyword) => contains(keyword, search)) === true;
        }}
        value={query}
        onValueChange={setQuery}
        autoHighlight="always"
        keepHighlight
      >
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.contextRow)}>
            <span id={contextId} {...stylex.props(typography.label, styles.context)}>
              {contextLabel}
            </span>
            <Dialog.Close aria-label="Close actions" />
          </div>
          <Autocomplete.Input
            ref={input}
            aria-label="Search actions"
            aria-describedby={instructionsId}
            placeholder="Search actions…"
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) event.preventBaseUIHandler();
            }}
            {...stylex.props(typography.body, styles.input)}
          />
          <p id={instructionsId} {...stylex.props(styles.visuallyHidden)}>
            Use the up and down arrow keys to navigate actions, Enter to choose, and Escape to
            close.
          </p>
          <ResultCount />
        </div>
        <div {...stylex.props(styles.results)}>
          <ScrollArea.Root>
            <ScrollArea.Viewport tabIndex={-1}>
              <ScrollArea.Content>
                <Autocomplete.Empty>
                  <p {...stylex.props(typography.label, styles.empty)}>No matching actions.</p>
                </Autocomplete.Empty>
                <Autocomplete.List aria-label="Actions" {...stylex.props(styles.list)}>
                  {(action: Action) => (
                    <Autocomplete.Item
                      key={action.id}
                      value={action}
                      disabled={action.disabled}
                      onClick={() => action.onSelect({ close })}
                      {...stylex.props(typography.label, styles.item)}
                    >
                      <span aria-hidden="true" {...stylex.props(styles.icon)}>
                        {action.icon}
                      </span>
                      <span {...stylex.props(styles.label)}>{action.label}</span>
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar />
          </ScrollArea.Root>
        </div>
        <p role="status" aria-atomic="true" {...stylex.props(typography.label, styles.status)}>
          {status}
        </p>
      </Autocomplete.Root>
    </Dialog.Popup>
  );
}

function ResultCount() {
  const count = Autocomplete.useFilteredItems<Action>().length;
  let label = "";

  if (count === 1) label = "1 matching action.";
  if (count > 1) label = `${count} matching actions.`;

  return (
    <Autocomplete.Status {...stylex.props(styles.visuallyHidden)}>{label}</Autocomplete.Status>
  );
}

const styles = stylex.create({
  header: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    gap: space[4],
    paddingBlock: space[4],
    paddingInline: space[5],
  },
  contextRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
  },
  context: {
    minWidth: 0,
    paddingBlock: space[1],
    paddingInline: space[3],
    borderRadius: radii.full,
    backgroundColor: colors.control,
    color: colors.textMuted,
    fontWeight: fonts.regular,
    fontVariantNumeric: "tabular-nums",
  },
  input: {
    width: "100%",
    minWidth: 0,
    minHeight: control.heightMd,
    paddingInline: 0,
    paddingBlock: space[2],
    borderWidth: 0,
    backgroundColor: "transparent",
    color: colors.text,
    "::placeholder": { color: colors.textPlaceholder, opacity: 1 },
    outlineStyle: "none",
  },
  results: {
    display: "flex",
    flexDirection: "column",
    height: "14rem",
    minHeight: 0,
    flexShrink: 1,
  },
  list: { paddingInline: space[2], paddingBlockEnd: space[2] },
  item: {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    minHeight: control.heightMd,
    paddingBlock: space[2],
    paddingInline: space[3],
    fontWeight: fonts.regular,
    borderRadius: radii.md,
    backgroundColor: { default: "transparent", "[data-highlighted]": colors.controlHovered },
    color: { default: colors.text, "[data-disabled]": colors.onControlDisabled },
    outlineStyle: {
      default: "none",
      "@media (forced-colors: active)": {
        default: "none",
        "[data-highlighted]": "solid",
      },
    },
    outlineWidth: "1px",
    outlineOffset: "-1px",
    outlineColor: "Highlight",
    cursor: "default",
  },
  icon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: control.iconSize,
    height: control.iconSize,
    color: "inherit",
    opacity: 0.7,
  },
  label: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  empty: { padding: space[5], color: colors.textMuted, fontWeight: fonts.regular },
  status: {
    flexShrink: 0,
    minHeight: `calc(${fonts.labelSize} * ${fonts.labelLeading} + ${space[6]})`,
    paddingInline: space[5],
    paddingBlock: space[3],
    color: colors.textMuted,
    fontWeight: fonts.regular,
  },
  visuallyHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    borderWidth: 0,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
});
