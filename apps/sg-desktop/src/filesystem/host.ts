import { BrowserWindow, dialog, type WebContents } from "electron";
import { Effect } from "effect";

export const chooseFolder = (contents: WebContents, title: string) =>
  Effect.tryPromise(async () => {
    const window = BrowserWindow.fromWebContents(contents);

    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      title,
      buttonLabel: "Use folder",
      properties: ["openDirectory"],
    });

    if (result.canceled) return null;

    return result.filePaths[0] ?? null;
  });
