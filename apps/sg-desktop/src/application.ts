import { Application, Module } from "@stargeist/application";
import { Backend, backendLayer } from "./backend";
import { WindowsModule } from "./window";

export const DesktopApplication = Application.define({
  modules: {
    windows: WindowsModule,
    backend: Module.define({ exports: Backend, layer: backendLayer }),
  },
  provide: backendLayer,
});
