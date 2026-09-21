# UI conventions

Run `bun run dev:ui` from the repository root, then open http://localhost:6006 for Storybook. Run `bun run build:ui` to produce a static catalog in `packages/ui/dist/storybook`.

Storybook belongs to this package. It shares the StyleX Vite configuration and CSS reset with the renderer, without starting desktop services or loading application routes. Desktop cursor and text-selection behavior stays in the renderer.

## Stories

Group each component and its `*.stories.tsx` file in a capability folder such as `src/button/`. The folder's `index.tsx` owns its implementation and public entry point. Single-file foundations such as tokens and typography remain at `src/`. Package exports keep consumer imports stable.

Use typed CSF stories (`Meta` and `StoryObj`). Document meaningful variants and compositions using the real components. Keep example state local to the story. Stories are interactive examples; this setup does not run DOM assertions or snapshot tests.

The catalog includes button controls and state comparisons, semantic icons, and contextual sidebar compositions with overflow and long labels. Use the Surface toolbar to compare controls against the actual canvas, surface, and raised-surface tokens. The Docs tab describes intended usage.

## Geometry

- `control.heightSm` and `control.heightMd` define minimum text-button heights. Navigation uses the medium height; icon buttons use it for both fixed dimensions.
- `control.radius` applies to buttons and navigation at every size. Container rounding remains independent.
- `control.iconSize` is the icon catalog's default. Icons inherit their control's foreground.
- Button labels use semibold weight; navigation uses the medium label weight.

## Color and state

- Solid actions pair `action` with `onAction`.
- Soft controls pair `control` with `onControl`.
- Ghost controls and navigation start transparent with `onControlMuted`; interaction uses `onControl`.
- Neutral controls use `controlHovered` and `controlPressed` for hover and momentary pressing. Solid actions use `actionHovered` and `actionPressed`.
- Current navigation uses `controlSelected`. It can share a palette value with pressing while remaining independently adjustable.
- Disabled controls use `onControlDisabled`. Solid and soft appearances use `controlDisabled`; ghost stays transparent. Hover and press styling exclude disabled controls.
- Keyboard focus uses `focusRing`. Navigation draws the ring inside its bounds to avoid clipping in the sidebar's scroll area.

## Manual review

Compare enabled and disabled appearances across all three backgrounds. Tab through controls, activate buttons with Enter and Space, and check that disabled controls do not increment the counter. Check navigation focus and selected states, narrow the window, and inspect long labels in the app.

Import icons from `@stargeist/ui/icons`. Lucide imports are restricted to the catalog. Keep control names in `aria-label` when no visible label exists.
