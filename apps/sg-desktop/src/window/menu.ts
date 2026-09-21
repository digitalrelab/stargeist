import { app, Menu, type MenuItemConstructorOptions } from "electron";
import { Effect } from "effect";
import type { RunScaleCommand } from "./scale";

export const installWindowMenu = Effect.fnUntraced(function* (changeScale: RunScaleCommand) {
  const view: MenuItemConstructorOptions[] = [];
  if (!app.isPackaged) {
    view.push(
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
    );
  }
  view.push(
    {
      label: "Increase Scale",
      accelerator: "CommandOrControl+Plus",
      click: () => changeScale("increase"),
    },
    {
      label: "Decrease Scale",
      accelerator: "CommandOrControl+-",
      click: () => changeScale("decrease"),
    },
    {
      label: "Reset Scale",
      accelerator: "CommandOrControl+0",
      click: () => changeScale("reset"),
    },
  );
  if (process.platform !== "darwin") {
    view.push({ type: "separator" }, { role: "togglefullscreen" });
  }

  const template: MenuItemConstructorOptions[] = [];
  if (process.platform === "darwin") template.push({ role: "appMenu" });
  template.push(
    { role: "fileMenu" },
    { role: "editMenu" },
    { label: "View", submenu: view },
    { role: "windowMenu" },
  );
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      const previous = Menu.getApplicationMenu();
      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
      return previous;
    }),
    (previous) => Effect.sync(() => Menu.setApplicationMenu(previous)),
  );
});
