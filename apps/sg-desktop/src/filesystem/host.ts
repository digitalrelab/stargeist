import { BrowserWindow, dialog, type WebContents } from "electron";
import { Effect, Layer } from "effect";

import { FolderPicker, FolderPickerError } from "./dialogs";

export const folderPickerLayer = (contents: WebContents) =>
  Layer.succeed(FolderPicker, {
    choose: (title) =>
      Effect.tryPromise({
        try: async () => {
          const window = BrowserWindow.fromWebContents(contents);
          if (!window) return null;
          const result = await dialog.showOpenDialog(window, {
            title,
            buttonLabel: "Use folder",
            properties: ["openDirectory"],
          });
          if (result.canceled) return null;
          return result.filePaths[0] ?? null;
        },
        catch: (cause) => new FolderPickerError({ cause }),
      }),
  });
