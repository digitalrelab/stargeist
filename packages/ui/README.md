# UI conventions

Run `bun run dev:ui` from the repository root for the interactive reference. It uses the renderer's styling pipeline and real UI components, without starting desktop services. Its HTML entry is separate from the production app entry.

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
