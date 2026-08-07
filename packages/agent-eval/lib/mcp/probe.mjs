/**
 * Setup-time MCP liveness probe. Runs *inside the sandbox*, before the agent.
 *
 * The first full matrix (D-26) spent four experiments' worth of tokens on runs
 * where the MCP tools were never exposed to the agent. Nothing failed: the
 * servers were configured, the harness was happy, and the numbers looked like a
 * clean +0.18 quality win. The agent had quietly read the servers off disk
 * instead.
 *
 * This speaks raw JSON-RPC to a staged server over stdio and insists on a
 * non-empty `tools/list`. It is the cheapest possible check — no model, no
 * tokens — and it turns "the servers silently did nothing" into a setup error
 * raised before the run costs anything.
 *
 * It proves the *server* works at the exact path `.mcp.json` will name. It
 * cannot prove Claude Code went on to connect to it; the transcript-side leak
 * and no-call detectors in `mcp-usage.ts` cover that half.
 *
 * Usage: node probe.mjs <absolute-path-to-server-entry>
 * Prints one JSON line; exits non-zero when no tools came back.
 */

import { spawn } from "node:child_process";

const entry = process.argv[2];
if (!entry) {
  console.log(JSON.stringify({ ok: false, error: "no server entry given" }));
  process.exit(2);
}

const child = spawn(process.execPath, [entry], {
  stdio: ["pipe", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);

let buffered = "";
const toolsListed = new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error("no tools/list response within 30s")),
    30_000,
  );

  child.on("error", (error) => {
    clearTimeout(timer);
    reject(new Error(`could not spawn server: ${error.message}`));
  });

  child.on("exit", (code, signal) => {
    clearTimeout(timer);
    reject(
      new Error(
        `server exited before answering (code=${code} signal=${signal})`,
      ),
    );
  });

  child.stdout.on("data", (chunk) => {
    buffered += chunk.toString();

    let newline;
    while ((newline = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, newline).trim();
      buffered = buffered.slice(newline + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue; // servers are entitled to log noise on stdout
      }

      if (message.id !== 2) continue;
      clearTimeout(timer);

      if (message.error) {
        reject(
          new Error(`tools/list failed: ${JSON.stringify(message.error)}`),
        );
      } else {
        resolve(message.result?.tools ?? []);
      }
      return;
    }
  });
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "agent-eval-probe", version: "1.0.0" },
  },
});
// Spec-required, and some servers refuse requests until they see it.
send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

try {
  const tools = await toolsListed;
  child.kill("SIGKILL");
  console.log(
    JSON.stringify({ ok: tools.length > 0, tools: tools.map((t) => t.name) }),
  );
  process.exit(tools.length > 0 ? 0 : 1);
} catch (error) {
  child.kill("SIGKILL");
  console.log(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stderr: stderr.slice(-2000),
    }),
  );
  process.exit(1);
}
