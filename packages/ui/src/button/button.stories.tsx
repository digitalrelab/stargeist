import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { action } from "storybook/actions";
import { Button } from "./index";
import { SettingsIcon } from "../icons";
import { space } from "../tokens.stylex";
import { typography } from "../typography";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    appearance: "solid",
    size: "md",
    disabled: false,
    children: "Action",
    onClick: action("clicked"),
  },
  argTypes: {
    appearance: {
      control: "inline-radio",
      options: ["solid", "soft", "ghost"],
      table: { type: { summary: "solid | soft | ghost" } },
    },
    size: {
      control: "inline-radio",
      options: ["sm", "md"],
      table: { type: { summary: "sm | md | icon" } },
    },
    disabled: { control: "boolean" },
    children: { control: "text" },
  },
  parameters: {
    controls: { include: ["appearance", "size", "disabled", "children"] },
    docs: {
      description: {
        component:
          "Solid emphasizes a primary action; soft provides a neutral surface; ghost stays quiet until interaction. Icon buttons are square and require an accessible name. Use the Surface toolbar to compare backgrounds.",
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Icon: Story = {
  args: {
    appearance: "ghost",
    size: "icon",
    children: <SettingsIcon aria-hidden="true" />,
    "aria-label": "Settings",
  },
  parameters: { controls: { include: ["appearance", "disabled"] } },
};

export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => <ButtonStates />,
};

function ButtonStates() {
  const [activations, setActivations] = useState(0);
  const activate = () => setActivations((count) => count + 1);

  return (
    <div {...stylex.props(styles.stack)}>
      <p>Use Tab, Enter, Space, and the pointer to inspect interaction states.</p>
      <output aria-live="polite">Button activations: {activations}</output>
      <div {...stylex.props(styles.viewport)}>
        <table {...stylex.props(styles.table, typography.label)}>
          <thead>
            <tr>
              <th>Appearance</th>
              <th>Small</th>
              <th>Medium</th>
              <th>Disabled</th>
              <th>Icon</th>
              <th>ARIA disabled</th>
            </tr>
          </thead>
          <tbody>
            {(["solid", "soft", "ghost"] as const).map((appearance) => (
              <tr key={appearance}>
                <th scope="row">{appearance}</th>
                <td>
                  <Button appearance={appearance} size="sm" onClick={activate}>
                    Action
                  </Button>
                </td>
                <td>
                  <Button appearance={appearance} onClick={activate}>
                    Action
                  </Button>
                </td>
                <td>
                  <Button appearance={appearance} disabled onClick={activate}>
                    Action
                  </Button>
                </td>
                <td>
                  <Button
                    appearance={appearance}
                    size="icon"
                    aria-label={`${appearance} settings`}
                    onClick={activate}
                  >
                    <SettingsIcon aria-hidden="true" />
                  </Button>
                </td>
                <td>
                  <Button
                    appearance={appearance}
                    size="icon"
                    aria-disabled="true"
                    aria-label={`${appearance} disabled settings`}
                    onClick={activate}
                  >
                    <SettingsIcon aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = stylex.create({
  stack: { display: "flex", flexDirection: "column", gap: space[4] },
  viewport: { overflowX: "auto", padding: space[1] },
  table: { borderSpacing: space[2], textAlign: "start" },
});
