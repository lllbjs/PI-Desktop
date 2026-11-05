import { homedir } from "node:os";
import { app } from "electron";
import { MCP_CONTROL_DEFAULT_PORT } from "./mcp-control";
import type { Logger } from "./logger";
import { launchSideBySideInstance, type SideBySideInstance } from "./new-instance";

/**
 * The File → New Instance action: starts a second desktop process with its own
 * data directory, Chromium profile, and MCP control port, so a user can keep
 * two workspaces open at once. ADR 0094 scopes the single-instance lock to the
 * data directory, which is what makes the second launch legal.
 *
 * The app facts live here rather than in `new-instance.ts` so the naming and
 * the launch arguments stay testable without a running app.
 *
 * Failures are logged and swallowed: a menu item must never take the instance
 * that clicked it down.
 */
export function openSideBySideInstance(
  logger?: Pick<Logger, "app">,
): SideBySideInstance | null {
  try {
    return launchSideBySideInstance({
      home: homedir(),
      appData: app.getPath("appData"),
      execPath: process.execPath,
      appPath: app.getAppPath(),
      packaged: app.isPackaged,
      env: process.env,
      mcpPortBase: MCP_CONTROL_DEFAULT_PORT,
    });
  } catch (error) {
    logger?.app("lifecycle", "warn", "side-by-side instance could not start", {
      data: { message: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
}
