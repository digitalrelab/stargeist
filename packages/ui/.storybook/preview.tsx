import type { Preview } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { colors } from "../src/colors.stylex";
import { typography } from "../src/typography";
import "../src/reset.css";

const styles = stylex.create({
  theme: { color: colors.text, colorScheme: "dark" },
});

const preview: Preview = {
  tags: ["autodocs"],
  initialGlobals: { backgrounds: { value: "canvas" } },
  parameters: {
    layout: "padded",
    controls: { expanded: true },
    backgrounds: {
      options: {
        canvas: { name: "Canvas", value: colors.canvas },
        surface: { name: "Surface", value: colors.surface },
        surfaceRaised: { name: "Raised surface", value: colors.surfaceRaised },
      },
    },
  },
  decorators: [
    (Story) => (
      <div {...stylex.props(typography.body, styles.theme)}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
