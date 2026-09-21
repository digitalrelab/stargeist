import { Application, Module } from "@stargeist/application";
import { app } from "electron";
import { Effect, Layer } from "effect";
import { Backend, backendLayer } from "./backend";
import { pathsLayer } from "./storage";
import { WindowsModule } from "./window";
import { userPreferencesLayer } from "./user-preferences";
import { UserPreferences } from "@stargeist/domain";

const paths = Layer.unwrap(Effect.sync(() => pathsLayer(app.getPath("userData"))));
const backend = backendLayer.pipe(Layer.provide(paths));
const preferences = userPreferencesLayer.pipe(Layer.provide(paths));

export const DesktopApplication = Application.define({
  modules: {
    windows: WindowsModule,
    backend: Module.define({ exports: Backend, layer: backend }),
    userPreferences: Module.define({ exports: UserPreferences, layer: preferences }),
  },
  provide: Layer.merge(backend, preferences),
});
