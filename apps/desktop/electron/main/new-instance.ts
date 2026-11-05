import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_NAME } from "@pi-desktop/shared";
import { INSTALLATION_DATA_DIR_NAME } from "./data-paths";

/**
 * A side-by-side instance: another desktop process with its own data
 * directory, its own Electron `userData`, and — when the MCP control server is
 * enabled — its own port.
 *
 * ADR 0094 keeps the single-instance lock scoped to the data directory, so a
 * launch that names a different one stays launchable while the shipped
 * installation runs (D236). Sharing either root would put two host-cores over
 * one `pi.sqlite` (D002) and two Chromium profiles over one `userData`;
 * sharing the port would leave the second MCP control server unable to bind.
 *
 * This module stays Electron-free so the naming and the launch arguments are
 * testable without a running app; `new-instance-launch.ts` supplies the app
 * facts.
 */

/** The shipped installation owns index 1; side-by-side profiles start at 2. */
export const FIRST_SIDE_BY_SIDE_INDEX = 2;
const MAX_SIDE_BY_SIDE_INDEX = 99;

/** `~/.pi-desktop-<n>`, beside the shipped `~/.pi-desktop`. */
export function sideBySideDataDir(index: number, home: string = homedir()): string {
  return join(home, `${INSTALLATION_DATA_DIR_NAME}-${index}`);
}

/** `<appData>/PI-Desktop <n>`, beside the shipped `PI-Desktop`. */
export function sideBySideUserDataDir(index: number, appData: string): string {
  return join(appData, `${APP_NAME} ${index}`);
}

/** The MCP control port of a side-by-side profile, offset from the default. */
export function sideBySideMcpPort(index: number, basePort: number): number {
  return basePort + (index - 1);
}

/**
 * Lowest index whose data directory does not exist yet, so an instance started
 * from a side-by-side instance does not land on its own root.
 */
export function nextInstanceIndex(
  home: string = homedir(),
  exists: (path: string) => boolean = existsSync,
): number {
  for (let index = FIRST_SIDE_BY_SIDE_INDEX; index <= MAX_SIDE_BY_SIDE_INDEX; index += 1) {
    if (!exists(sideBySideDataDir(index, home))) return index;
  }
  throw new Error(`No free side-by-side profile index below ${MAX_SIDE_BY_SIDE_INDEX}.`);
}

export type SideBySideLaunchInput = {
  execPath: string;
  /** The unpackaged app directory; a packaged build runs its own binary. */
  appPath: string;
  packaged: boolean;
  dataDir: string;
  userDataDir: string;
  /** Absent when the launching instance has the MCP control server off. */
  mcpPort?: number;
  env: NodeJS.ProcessEnv;
};

export type SideBySideLaunch = {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
};

export function buildSideBySideLaunch(input: SideBySideLaunchInput): SideBySideLaunch {
  const env: NodeJS.ProcessEnv = { ...input.env, PI_DESKTOP_DATA_DIR: input.dataDir };
  // An inherited port or profile would collide with the instance that set it.
  delete env.PI_DESKTOP_MCP_PORT;
  if (input.mcpPort !== undefined) env.PI_DESKTOP_MCP_PORT = String(input.mcpPort);
  // Without its own Chromium profile the two instances would share
  // `localStorage`, the plugin panel partitions, and the browser pane cookies.
  const args = [`--user-data-dir=${input.userDataDir}`];
  // An unpackaged build is started through the Electron binary, so it needs
  // its app directory; a packaged build is its own executable.
  if (!input.packaged) args.push(input.appPath);
  return { command: input.execPath, args, env };
}

export type SideBySideSpawn = (
  command: string,
  args: string[],
  options: { detached: boolean; stdio: "ignore"; env: NodeJS.ProcessEnv },
) => { unref(): void };

export type SideBySideDeps = {
  home: string;
  appData: string;
  execPath: string;
  appPath: string;
  packaged: boolean;
  env: NodeJS.ProcessEnv;
  /** Base of the derived MCP control ports; unused when MCP control is off. */
  mcpPortBase: number;
  exists?: (path: string) => boolean;
  spawn?: SideBySideSpawn;
};

export type SideBySideInstance = {
  index: number;
  dataDir: string;
  userDataDir: string;
  command: string;
  args: string[];
};

/**
 * Starts the new instance detached — it must outlive the window that asked for
 * it — and returns the profile it took.
 */
export function launchSideBySideInstance(deps: SideBySideDeps): SideBySideInstance {
  const spawnProcess: SideBySideSpawn =
    deps.spawn ?? ((command, args, options) => spawn(command, args, options));
  const index = nextInstanceIndex(deps.home, deps.exists);
  const dataDir = sideBySideDataDir(index, deps.home);
  const userDataDir = sideBySideUserDataDir(index, deps.appData);
  const mcpPort =
    deps.env.PI_DESKTOP_MCP_CONTROL === "1"
      ? sideBySideMcpPort(index, deps.mcpPortBase)
      : undefined;
  const launch = buildSideBySideLaunch({
    execPath: deps.execPath,
    appPath: deps.appPath,
    packaged: deps.packaged,
    dataDir,
    userDataDir,
    mcpPort,
    env: deps.env,
  });
  const child = spawnProcess(launch.command, launch.args, {
    detached: true,
    stdio: "ignore",
    env: launch.env,
  });
  child.unref();
  return { index, dataDir, userDataDir, command: launch.command, args: launch.args };
}
