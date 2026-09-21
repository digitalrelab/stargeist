import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { action } from "storybook/actions";
import { Button } from "../button";
import { colors } from "../colors.stylex";
import { BackIcon, SettingsIcon } from "../icons";
import * as Sidebar from "./index";
import { space } from "../tokens.stylex";
import { typography } from "../typography";

const meta = {
  title: "UI/Sidebar",
  component: Sidebar.Root,
  args: { "aria-label": "Library" },
  argTypes: { "aria-label": { control: "text" } },
  parameters: {
    layout: "fullscreen",
    controls: { include: ["aria-label"] },
    docs: {
      description: {
        component: `Compose the parts below. The parent sets the sidebar's dimensions; the consumer owns navigation and contextual content. Parts accept native element props, except className and style.

| Part | Element | Responsibility |
| --- | --- | --- |
| Root | aside | Contains the sidebar. Give it an accessible name. |
| Header | div | Keeps the heading and controls above the scrolling content. |
| Content | div | Fills available space and scrolls when necessary. |
| Nav | nav | Groups links. Name each navigation landmark with aria-label. |
| Link | a | Accepts anchor props and Ariakit's render prop for router links. Mark the current destination with aria-current="page". |
| Footer | div | Keeps persistent actions below the scrolling content. |`,
      },
    },
  },
} satisfies Meta<typeof Sidebar.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Composition: Story = {
  parameters: {
    docs: {
      source: { type: "code" },
      description: {
        story:
          "Actions are logged in the Actions panel. The Navigation example below demonstrates contextual navigation.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div {...stylex.props(styles.composition)}>
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Sidebar.Root {...args}>
      <Sidebar.Header>
        <h2 {...stylex.props(typography.heading)}>Library</h2>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Nav aria-label="Collections">
          <Sidebar.Link
            href="#collection"
            aria-current="page"
            onClick={(event) => {
              event.preventDefault();
              action("navigate")("collection");
            }}
          >
            Collection
          </Sidebar.Link>
        </Sidebar.Nav>
      </Sidebar.Content>
      <Sidebar.Footer>
        <Button appearance="ghost" size="icon" aria-label="Settings" onClick={action("settings")}>
          <SettingsIcon aria-hidden="true" />
        </Button>
      </Sidebar.Footer>
    </Sidebar.Root>
  ),
};

export const Navigation: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "The consumer owns selection and switches the sidebar content when Settings or Back is activated.",
      },
    },
  },
  render: () => <SidebarExample />,
};

export const Overflow: Story = {
  parameters: { controls: { disable: true } },
  render: () => <SidebarExample itemCount={40} />,
};

export const Settings: Story = {
  parameters: { controls: { disable: true } },
  render: () => <SidebarExample initialPage="settings" />,
};

function SidebarExample({
  itemCount = 5,
  initialPage = "item-1",
}: {
  itemCount?: number;
  initialPage?: string;
}) {
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
  composition: {
    display: "grid",
    width: "15rem",
    maxWidth: "100%",
    height: "32rem",
    maxHeight: "100dvh",
  },
  frame: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 15rem) minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    height: "32rem",
    maxHeight: "100dvh",
    backgroundColor: colors.canvas,
  },
  content: {
    minWidth: 0,
    padding: space[6],
    backgroundColor: colors.surface,
    overflowWrap: "anywhere",
  },
});
