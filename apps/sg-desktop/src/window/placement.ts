import { screen, type Rectangle } from "electron";

export function windowPlacement(saved: Rectangle | null) {
  let display = screen.getPrimaryDisplay();
  if (saved) display = screen.getDisplayMatching(saved);

  const area = display.workArea;
  const minWidth = Math.min(360, area.width);
  const minHeight = Math.min(420, area.height);
  const width = Math.min(Math.max(saved?.width ?? 1100, minWidth), area.width);
  const height = Math.min(Math.max(saved?.height ?? 760, minHeight), area.height);
  const x = saved?.x ?? area.x + Math.floor((area.width - width) / 2);
  const y = saved?.y ?? area.y + Math.floor((area.height - height) / 2);

  return {
    bounds: {
      x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
      y: Math.max(area.y, Math.min(y, area.y + area.height - height)),
      width,
      height,
    },
    minWidth,
    minHeight,
  };
}
