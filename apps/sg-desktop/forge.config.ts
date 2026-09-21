import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

export default {
  packagerConfig: { asar: true, name: "Stargeist", appBundleId: "com.digitalrelab.stargeist" },
  makers: [
    new MakerSquirrel({ name: "Stargeist" }),
    new MakerZIP({}, ["darwin"]),
    new MakerDeb({
      options: {
        maintainer: "digitalrelab",
        homepage: "https://github.com/digitalrelab/stargeist",
      },
    }),
    new MakerRpm({ options: { homepage: "https://github.com/digitalrelab/stargeist" } }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: "src/main.ts", config: "vite.main.config.ts", target: "main" },
        { entry: "src/backend/main.ts", config: "vite.backend.config.ts", target: "main" },
        { entry: "src/preload.ts", config: "vite.preload.config.ts", target: "preload" },
      ],
      renderer: [{ name: "main_window", config: "vite.renderer.config.ts" }],
    }),
  ],
} satisfies ForgeConfig;
