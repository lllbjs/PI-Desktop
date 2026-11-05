import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { register } from "node:module";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readMainModule } from "./helpers/main-source.mjs";

const here = dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(join(here, "helpers/ts-import-hooks.mjs")));

const {
  FIRST_SIDE_BY_SIDE_INDEX,
  buildSideBySideLaunch,
  launchSideBySideInstance,
  nextInstanceIndex,
  sideBySideDataDir,
  sideBySideUserDataDir,
  sideBySideMcpPort,
} = await import("../electron/main/new-instance.ts");

const home = join("/Users", "tester");
const appData = join(home, "Library", "Application Support");
const shippedDataDir = join(home, ".pi-desktop");
const shippedUserDataDir = join(appData, "PI-Desktop");

function launchInput(overrides = {}) {
  return {
    execPath: "/Applications/PI-Desktop.app/Contents/MacOS/PI-Desktop",
    appPath: "/repo/apps/desktop",
    packaged: true,
    dataDir: sideBySideDataDir(2, home),
    userDataDir: sideBySideUserDataDir(2, appData),
    env: { PATH: "/usr/bin" },
    ...overrides,
  };
}

test("a side-by-side instance owns its own data directory and Chromium profile", () => {
  assert.equal(FIRST_SIDE_BY_SIDE_INDEX, 2);
  assert.equal(sideBySideDataDir(2, home), join(home, ".pi-desktop-2"));
  assert.equal(sideBySideDataDir(3, home), join(home, ".pi-desktop-3"));
  assert.equal(sideBySideUserDataDir(2, appData), join(appData, "PI-Desktop 2"));
  // The shipped installation keeps its own roots: the new profile sits beside
  // them rather than replacing them (ADR 0094).
  assert.notEqual(sideBySideDataDir(2, home), shippedDataDir);
  assert.notEqual(sideBySideUserDataDir(2, appData), shippedUserDataDir);
});

test("the next profile skips the directories that already exist", () => {
  const taken = new Set([sideBySideDataDir(2, home), sideBySideDataDir(3, home)]);
  assert.equal(
    nextInstanceIndex(home, (path) => taken.has(path)),
    4,
  );
  // A second instance started from a side-by-side instance must not land on the
  // profile that is already running.
  assert.equal(
    nextInstanceIndex(home, () => false),
    FIRST_SIDE_BY_SIDE_INDEX,
  );
});

test("each instance gets its own MCP control port", () => {
  assert.equal(sideBySideMcpPort(2, 37123), 37124);
  assert.equal(sideBySideMcpPort(5, 37123), 37127);
});

test("a packaged launch runs the same binary against the new profile", () => {
  const launch = buildSideBySideLaunch(
    launchInput({ env: { PATH: "/usr/bin", PI_DESKTOP_DATA_DIR: shippedDataDir } }),
  );
  assert.equal(launch.command, "/Applications/PI-Desktop.app/Contents/MacOS/PI-Desktop");
  assert.deepEqual(launch.args, [`--user-data-dir=${sideBySideUserDataDir(2, appData)}`]);
  // The launcher's own data directory must not leak into the new instance.
  assert.equal(launch.env.PI_DESKTOP_DATA_DIR, sideBySideDataDir(2, home));
  assert.equal(launch.env.PATH, "/usr/bin");
});

test("an unpackaged launch names the Electron app directory", () => {
  const launch = buildSideBySideLaunch(launchInput({ packaged: false }));
  assert.deepEqual(launch.args, [
    `--user-data-dir=${sideBySideUserDataDir(2, appData)}`,
    "/repo/apps/desktop",
  ]);
});

test("an inherited MCP port is replaced, and only when MCP control is on", () => {
  const inherited = buildSideBySideLaunch(
    launchInput({ env: { PI_DESKTOP_MCP_CONTROL: "1", PI_DESKTOP_MCP_PORT: "37123" } }),
  );
  assert.equal(inherited.env.PI_DESKTOP_MCP_PORT, undefined);

  const derived = buildSideBySideLaunch(launchInput({ mcpPort: 37124 }));
  assert.equal(derived.env.PI_DESKTOP_MCP_PORT, "37124");
});

test("the new instance is detached from the one that opened it", () => {
  const calls = [];
  const instance = launchSideBySideInstance({
    home,
    appData,
    execPath: "/Applications/PI-Desktop.app/Contents/MacOS/PI-Desktop",
    appPath: "/repo/apps/desktop",
    packaged: true,
    env: { PI_DESKTOP_MCP_CONTROL: "1", PI_DESKTOP_MCP_PORT: "37123" },
    mcpPortBase: 37123,
    exists: () => false,
    spawn: (command, args, options) => {
      calls.push({ command, args, options });
      return {
        unref: () => {
          calls.push("unref");
        },
      };
    },
  });

  assert.equal(instance.index, 2);
  assert.equal(instance.dataDir, sideBySideDataDir(2, home));
  assert.equal(instance.userDataDir, sideBySideUserDataDir(2, appData));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, "/Applications/PI-Desktop.app/Contents/MacOS/PI-Desktop");
  assert.equal(calls[0].options.detached, true);
  assert.equal(calls[0].options.stdio, "ignore");
  assert.equal(calls[0].options.env.PI_DESKTOP_DATA_DIR, sideBySideDataDir(2, home));
  assert.equal(calls[0].options.env.PI_DESKTOP_MCP_PORT, "37124");
  assert.equal(calls[1], "unref");
});

test("the File menu offers a new instance and the app wires the action", async () => {
  const menuSource = await readMainModule("application-menu.ts");
  assert.match(menuSource, /openNewInstance\?: \(\) => void/);
  assert.match(menuSource, /label: labels\.menu\.newInstance/);
  assert.match(menuSource, /click: \(\) => openNewInstance\(\)/);

  const lifecycleSource = await readMainModule("bootstrap/app-lifecycle.ts");
  assert.match(lifecycleSource, /openNewInstance: \(\) => openSideBySideInstance\(logger\)/);
});
