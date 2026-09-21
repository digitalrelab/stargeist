import { Application, Module } from "@stargeist/application";
import { app } from "electron";
import { Effect, Layer } from "effect";
import { Backend, backendLayer } from "./backend";
import { pathsLayer } from "./storage";
import { WindowsModule } from "./window";

const paths = Layer.unwrap(Effect.sync(() => pathsLayer(app.getPath("userData"))));
const backend = backendLayer.pipe(Layer.provide(paths));

export const DesktopApplication = Application.define({
  modules: {
    windows: WindowsModule,
    backend: Module.define({ exports: Backend, layer: backend }),
  },
  provide: backend,
});
