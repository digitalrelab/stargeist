export const platforms = ["linux", "darwin", "win32"] as const;
export type Platform = (typeof platforms)[number];

export interface WorkspacePackage {
  name: string;
  directory: string;
  platforms: Platform[];
  tests: boolean;
  build: boolean;
}

export interface Change {
  base: string | null;
  head: string;
  workingTree: boolean;
  files: string[];
}

export interface Plan {
  version: 1;
  change: Change;
  packages: WorkspacePackage[];
  excluded: string[];
  matrix: { include: Array<{ platform: Platform; runner: string; desktop: boolean }> };
}

const runners: Record<Platform, string> = {
  linux: "ubuntu-24.04",
  darwin: "macos-15",
  win32: "windows-2025",
};

export function planChecks(
  packages: WorkspacePackage[],
  selected: ReadonlySet<string>,
  change: Change,
): Plan {
  const affected = packages.filter((pkg) => selected.has(pkg.name));
  const excluded = packages.filter((pkg) => !selected.has(pkg.name)).map((pkg) => pkg.name);

  const include = platforms
    .filter((platform) =>
      affected.some((pkg) => pkg.platforms.includes(platform) && (pkg.tests || pkg.build)),
    )
    .map((platform) => ({
      platform,
      runner: runners[platform],
      desktop: affected.some(
        (pkg) => pkg.name === "@stargeist/desktop" && pkg.build && pkg.platforms.includes(platform),
      ),
    }));

  return { version: 1, change, packages: affected, excluded, matrix: { include } };
}
