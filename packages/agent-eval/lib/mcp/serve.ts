/**
 * Host-side MCP servers (ADR 55).
 *
 * The servers used to be uploaded into the sandbox and launched over stdio.
 * That put their entire source tree, and — for `design-tokens` — the token
 * files themselves, on a filesystem the agent can read, and agents did read
 * them: two of four arms on `812` came back `RUN INVALID` for exactly this.
 * The path could not be hidden, because the agent's own user has to be able to
 * execute what it can read.
 *
 * So nothing ships. Both servers run here, on the host, in the Streamable HTTP
 * mode they already support, and the sandbox gets a URL. There is no file to
 * find because there is no file.
 *
 * Lifecycle is tied to this process: servers start on first use, are shared
 * across every trial and variant in the run, and are killed when the CLI exits.
 * They are stateless, so sharing one instance across trials is safe.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** `packages/` in this monorepo, from `lib/mcp/`. */
const PACKAGES_DIR = fileURLToPath(new URL("../../..", import.meta.url));

/**
 * Ports the servers listen on.
 *
 * Deliberately not 8080, which is both servers' own default and the likeliest
 * thing to already be occupied on a developer machine. A port collision here
 * surfaces as a readiness timeout before any agent starts, so it costs a
 * container rather than a trial — but it is still better not to collide.
 */
const PORTS: Record<string, number> = {
  "component-builder": 8791,
  "design-tokens": 8792,
};

const READY_TIMEOUT_MS = 20_000;
const READY_POLL_MS = 200;

interface HostServer {
  port: number;
  process: ChildProcess;
  ready: Promise<void>;
}

const running = new Map<string, HostServer>();

let exitHooked = false;

function hookExit(): void {
  if (exitHooked) return;
  exitHooked = true;

  const stopAll = () => {
    for (const server of running.values()) server.process.kill("SIGTERM");
    running.clear();
  };

  process.on("exit", stopAll);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      stopAll();
      process.exit(130);
    });
  }
}

async function waitForHealth(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `MCP server on port ${port} exited during startup with code ${child.exitCode}.`,
      );
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }

    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }

  child.kill("SIGTERM");
  throw new Error(
    `MCP server on port ${port} was not healthy within ${READY_TIMEOUT_MS}ms. ` +
      `Is something else already bound to that port?`,
  );
}

/**
 * Start a server if it is not already running, and resolve once it answers on
 * `/health`.
 *
 * Idempotent per server name: `setupVariant()` runs once per trial and the
 * matrix is dozens of trials, so this has to be cheap after the first call.
 */
export async function ensureHostServer(
  name: string,
  packageDir: string,
): Promise<number> {
  const existing = running.get(name);
  if (existing) {
    await existing.ready;
    return existing.port;
  }

  const port = PORTS[name];
  if (!port) {
    throw new Error(
      `No host port assigned for MCP server "${name}". Add one to PORTS.`,
    );
  }

  const entry = `${PACKAGES_DIR}${packageDir}/dist/index.js`;
  if (!existsSync(entry)) {
    throw new Error(
      `MCP server "${name}" is not built — ${entry} does not exist.\n` +
        `Run: pnpm --filter ${packageDir} build`,
    );
  }

  hookExit();

  const child = spawn("node", [entry], {
    // The servers log to stderr and read nothing from stdin. `MCP_JWT_SECRET`
    // is deliberately not set: auth off is the documented local-development
    // mode, and a bearer token would only be one more thing in `.mcp.json` for
    // an agent to find.
    env: { ...process.env, MCP_TRANSPORT: "http", MCP_PORT: String(port) },
    stdio: ["ignore", "ignore", "pipe"],
  });

  const server: HostServer = {
    port,
    process: child,
    ready: waitForHealth(port, child),
  };
  running.set(name, server);

  await server.ready;
  return port;
}

/** Stop every host server. Exposed for `bin/setup-check.ts`, which is short-lived. */
export function stopHostServers(): void {
  for (const server of running.values()) server.process.kill("SIGTERM");
  running.clear();
}
