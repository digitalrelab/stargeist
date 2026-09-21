import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { BackIcon, SettingsIcon } from "./index";
import { space } from "../tokens.stylex";

const meta = {
  title: "UI/Icons",
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          "Import icons by meaning from @stargeist/ui/icons. They use the shared icon size and inherit foreground color. Label the containing control when its icon is decorative.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {
  render: () => (
    <div {...stylex.props(styles.catalog)}>
      <div {...stylex.props(styles.entry)}>
        <BackIcon aria-hidden="true" />
        <span>BackIcon</span>
      </div>
      <div {...stylex.props(styles.entry)}>
        <SettingsIcon aria-hidden="true" />
        <span>SettingsIcon</span>
      </div>
    </div>
  ),
};

const styles = stylex.create({
  catalog: { display: "flex", flexWrap: "wrap", gap: space[6] },
  entry: { display: "flex", alignItems: "center", gap: space[2] },
});
