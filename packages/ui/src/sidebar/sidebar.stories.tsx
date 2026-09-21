import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { Button } from "../button";
import { colors } from "../colors.stylex";
import { BackIcon, SettingsIcon } from "../icons";
import * as Sidebar from "./index";
import { space } from "../tokens.stylex";
import { typography } from "../typography";

const meta = {
  title: "UI/Sidebar",
  render: (args) => <SidebarExample {...args} />,
  args: { itemCount: 5, initialPage: "item-1" },
  argTypes: {
    itemCount: { control: { type: "range", min: 1, max: 50, step: 1 } },
    initialPage: { control: false },
  },
  parameters: {
    controls: { include: ["itemCount"] },
    docs: {
      description: {
        component:
          "Compose Root, Header, Content, Nav, Link, and Footer. Content owns scrolling; the header and footer stay visible. Navigation state and contextual content belong to the consumer. Activate Settings and Back to explore both compositions.",
      },
    },
  },
} satisfies Meta<{ itemCount: number; initialPage: string }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Navigation: Story = {};
export const Overflow: Story = { args: { itemCount: 40 } };
export const Settings: Story = { args: { initialPage: "settings" } };

function SidebarExample({ itemCount, initialPage }: { itemCount: number; initialPage: string }) {
  const [page, setPage] = useState(initialPage);
  const settings = page === "settings";
  const items = settings
    ? [{ id: "settings", label: "General" }]
    : Array.from({ length: itemCount }, (_, index) => ({
        id: `item-${index + 1}`,
        label:
          index === 1
            ? "A collection with a very long name that should truncate"
            : `Collection ${index + 1}`,
      }));
  const current = items.find((item) => item.id === page) ?? items[0];

  return (
    <div {...stylex.props(styles.frame)}>
      <Sidebar.Root aria-label={settings ? "Settings" : "Library"}>
        <Sidebar.Header>
          <h2 {...stylex.props(typography.heading)}>{settings ? "Settings" : "Library"}</h2>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Nav aria-label={settings ? "Settings sections" : "Collections"}>
            {items.map(({ id, label }) => (
              <Sidebar.Link
                key={id}
                href={`#${id}`}
                aria-current={current?.id === id ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setPage(id);
                }}
              >
                {label}
              </Sidebar.Link>
            ))}
          </Sidebar.Nav>
        </Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.Nav aria-label="Application">
            <Button
              appearance="ghost"
              size="icon"
              aria-label={settings ? "Back to library" : "Settings"}
              onClick={() => setPage(settings ? "item-1" : "settings")}
            >
              {settings ? <BackIcon aria-hidden="true" /> : <SettingsIcon aria-hidden="true" />}
            </Button>
          </Sidebar.Nav>
        </Sidebar.Footer>
      </Sidebar.Root>
      <main {...stylex.props(styles.content)}>
        <h1 {...stylex.props(typography.heading)}>{current?.label}</h1>
      </main>
    </div>
  );
}

const styles = stylex.create({
  frame: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 15rem) minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    height: "32rem",
    maxHeight: `calc(100dvh - 2 * ${space[6]})`,
    backgroundColor: colors.canvas,
  },
  content: {
    minWidth: 0,
    padding: space[6],
    backgroundColor: colors.surface,
    overflowWrap: "anywhere",
  },
});
