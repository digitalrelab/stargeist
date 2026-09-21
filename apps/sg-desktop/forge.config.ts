import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

const executableName = "Stargeist";

const linuxPackageOptions = {
  name: "stargeist",
  bin: executableName,
  homepage: "https://github.com/digitalrelab/stargeist",
};

export default {
  packagerConfig: {
    asar: true,
    name: executableName,
    executableName,
    appBundleId: "com.digitalrelab.stargeist",
  },
  makers: [
    new MakerSquirrel({ name: executableName }),
    new MakerZIP({}, ["darwin"]),
    new MakerDeb({
      options: {
        ...linuxPackageOptions,
        maintainer: "digitalrelab",
      },
    }),
    new MakerRpm({ options: linuxPackageOptions }),
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
