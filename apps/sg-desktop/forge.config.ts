import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { productName } from "./package.json";

const executableName = productName;
const icon = fileURLToPath(new URL("./icons/icon", import.meta.url));

const linuxPackageOptions = {
  name: "stargeist",
  bin: executableName,
  homepage: "https://github.com/digitalrelab/stargeist",
  icon: `${icon}.png`,
};

export default {
  hooks: {
    preStart: async () => {
      if (process.platform !== "darwin") return;

      const require = createRequire(import.meta.url);
      const electron = require.resolve("electron/package.json");
      const plist = join(dirname(electron), "dist", "Electron.app", "Contents", "Info.plist");
      await promisify(execFile)("/usr/libexec/PlistBuddy", [
        "-c",
        `Set :CFBundleName ${productName}`,
        "-c",
        `Set :CFBundleDisplayName ${productName}`,
        plist,
      ]);
    },
  },
  packagerConfig: {
    name: executableName,
    executableName,
    appBundleId: "com.digitalrelab.stargeist",
    icon,
    extraResource: [fileURLToPath(new URL("../../LICENSE", import.meta.url)), `${icon}.png`],
  },
  makers: [
    new MakerSquirrel({
      name: executableName,
      setupIcon: `${icon}.ico`,
      iconUrl:
        "https://raw.githubusercontent.com/digitalrelab/stargeist/main/apps/sg-desktop/icons/icon.ico",
    }),
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
