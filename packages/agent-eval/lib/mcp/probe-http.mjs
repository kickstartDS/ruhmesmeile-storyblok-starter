/**
 * In-sandbox reachability probe for the host-side MCP servers (ADR 55).
 *
 * Runs inside the container, before the agent, and speaks the exact protocol
 * over the exact URL Claude Code will use. A server that is up on the host but
 * unreachable across the docker bridge fails here — costing a container start
 * rather than a trial.
 *
 * Usage: node probe-http.mjs <url>
 */

const url = process.argv[2];

if (!url) {
  console.error("usage: node probe-http.mjs <url>");
  process.exit(2);
}

const body = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {},
};

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // The Streamable HTTP transport requires the client to accept both.
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    console.error(`HTTP ${response.status} from ${url}`);
    process.exit(1);
  }

  // Stateless Streamable HTTP answers either as JSON or as a single SSE event.
  const raw = await response.text();
  const payload = raw.includes("data:")
    ? raw
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("")
    : raw;

  const tools = JSON.parse(payload)?.result?.tools;

  if (!Array.isArray(tools) || tools.length === 0) {
    console.error(`${url} answered tools/list with no tools.`);
    process.exit(1);
  }

  console.log(`${tools.length}`);
} catch (error) {
  console.error(`${url} unreachable: ${error.message}`);
  process.exit(1);
}
