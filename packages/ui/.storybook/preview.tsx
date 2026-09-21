import type { Preview } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { colors } from "../src/colors.stylex";
import { space } from "../src/tokens.stylex";
import { typography } from "../src/typography";
import "../src/reset.css";

const styles = stylex.create({
  frame: { color: colors.text, colorScheme: "dark", padding: space[6] },
  fullscreen: { minHeight: "100dvh" },
});

const surfaces = stylex.create({
  canvas: { backgroundColor: colors.canvas },
  surface: { backgroundColor: colors.surface },
  surfaceRaised: { backgroundColor: colors.surfaceRaised },
});

const preview: Preview = {
  tags: ["autodocs"],
  globalTypes: {
    surface: {
      description: "Preview background",
      toolbar: {
        title: "Surface",
        icon: "circlehollow",
        items: [
          { value: "canvas", title: "Canvas" },
          { value: "surface", title: "Surface" },
          { value: "surfaceRaised", title: "Raised surface" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { surface: "canvas" },
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    backgrounds: { disable: true },
  },
  decorators: [
    (Story, context) => (
      <div
        {...stylex.props(
          typography.body,
          styles.frame,
          context.viewMode === "story" && styles.fullscreen,
          surfaces[context.globals.surface as keyof typeof surfaces],
        )}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
