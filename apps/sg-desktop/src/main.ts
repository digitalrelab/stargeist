import { app } from "electron";
import squirrelStartup from "electron-squirrel-startup";
import { Effect } from "effect";
import { desktopProgram } from "./application";
import { runDesktop } from "./lifecycle";

if (squirrelStartup) {
  app.quit();
} else {
  Effect.runFork(runDesktop(desktopProgram));
}
