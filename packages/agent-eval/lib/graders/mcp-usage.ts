/**
 * 1.11 / 1.12 — transcript-derived graders.
 *
 * These read the meta file `EVAL.ts` writes in-sandbox (ADR Decision 15), not
 * the harness's own o11y bundle, which is populated only when upstream's
 * single-path transcript capture happens to succeed.
 *
 * `mcp-usage` is diagnostic, not gating: Anthropic's rule is to grade the
 * product, not the path. It carries no weight in the composite score and is
 * reported so that a variant scoring well *without* touching its MCP is
 * visible rather than flattering.
 *
 * `negative-usage` is the opposite — it gates. If a `none` trial ever reaches
 * an MCP, every delta computed against that baseline is worthless, so this must
 * fail loudly.
 */

import { check, result, notApplicable, type GraderResult } from "./types";
import { readRawTranscript, type Trial } from "./trial";
import { MCP_RUNTIME_DIR_NAME, MCP_UPLOAD_DIR } from "../mcp/variants";

export interface McpUsage {
  applicable: boolean;
  totalCalls: number;
  byTool: Record<string, number>;
  byServer: Record<string, number>;
  /** First MCP tool called, if any — the "did it consult before writing" signal. */
  firstCall: string | null;
  /**
   * MCP work the agent handed to a subagent. Non-null means the call counts
   * above are a floor, not a total: see `delegationOf`.
   */
  delegated: McpDelegation | null;
}

/** MCP tool calls made inside a subagent, which we can only infer. */
export interface McpDelegation {
  servers: string[];
  tools: string[];
}

/** `mcp__<server>__<tool>` is Claude Code's naming for MCP tools. */
function serverOf(toolName: string): string {
  const parts = toolName.split("__");
  return parts.length >= 2 ? parts[1]! : "unknown";
}

/** Tools that spawn a subagent whose turns never reach our transcript. */
const SUBAGENT_TOOLS = /^(Agent|Task)$/;
const MCP_TOOL_REF = /mcp__([a-z0-9-]+)__([a-z0-9_-]+)/gi;

/**
 * Did the agent delegate its MCP calls to a subagent?
 *
 * Claude Code's `Agent`/`Task` tool runs a nested conversation, and — verified
 * against a real run — that conversation is *not* written to the session
 * transcript: every record we capture carries `isSidechain: false`. So a trial
 * can consult its MCP servers thoroughly and still report zero calls.
 *
 * That is exactly what happened in `cc-component-builder` run-2 of the first
 * valid matrix. The agent resolved four tools via `ToolSearch`, then asked a
 * subagent to call them and "report back their FULL raw output". Our counter
 * saw nothing and the trial was excluded as "configured but never called" —
 * scored, in other words, as if it were the baseline it plainly was not.
 *
 * We detect the delegation by its one visible trace: the subagent's prompt
 * names the `mcp__server__tool` identifiers. That is evidence the calls were
 * *requested*, not that they succeeded, so a delegated trial keeps its quality
 * score but is withheld from the call- and token-count averages rather than
 * being folded in as a zero.
 */
export function delegationOf(trial: Trial): McpDelegation | null {
  const raw = readRawTranscript(trial);
  if (!raw) return null;

  const servers = new Set<string>();
  const tools = new Set<string>();

  for (const line of raw.split("\n")) {
    if (!line.includes("mcp__")) continue; // cheap reject before JSON.parse

    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const content = (entry as { message?: { content?: unknown } })?.message
      ?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (
        !block ||
        typeof block !== "object" ||
        (block as { type?: string }).type !== "tool_use" ||
        !SUBAGENT_TOOLS.test(String((block as { name?: unknown }).name ?? ""))
      ) {
        continue;
      }

      const input = JSON.stringify((block as { input?: unknown }).input ?? {});
      for (const [tool, server] of input.matchAll(MCP_TOOL_REF)) {
        servers.add(server!.toLowerCase());
        tools.add(tool!);
      }
    }
  }

  return servers.size
    ? { servers: [...servers].sort(), tools: [...tools].sort() }
    : null;
}

/**
 * Were the MCP tools deferred behind `ToolSearch` rather than handed to the
 * model upfront?
 *
 * Claude Code announces deferral in a `deferred_tools_delta` attachment that
 * lists tool *names* only. The model cannot call any of them until it calls
 * `ToolSearch` to load a definition, so a trial in this regime that reports
 * zero MCP calls has not necessarily declined the server — it may never have
 * been able to reach it. Distinguishing the two is the difference between a
 * finding about the model and a finding about our own configuration (D-149).
 *
 * `setupVariant` now sets `ENABLE_TOOL_SEARCH=false`, so this should be false
 * for every new trial. If it is not, the setting did not take effect and the
 * variant is not the variant we think it is.
 */
export function mcpToolsWereDeferred(trial: Trial): boolean {
  const raw = readRawTranscript(trial);
  if (!raw) return false;

  for (const line of raw.split("\n")) {
    if (!line.includes("deferred_tools_delta") || !line.includes("mcp__")) {
      continue;
    }

    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const attachment = (entry as { attachment?: { type?: string; addedNames?: unknown } })
      ?.attachment;
    if (attachment?.type !== "deferred_tools_delta") continue;

    const names = attachment.addedNames;
    if (
      Array.isArray(names) &&
      names.some((name) => typeof name === "string" && name.startsWith("mcp__"))
    ) {
      return true;
    }
  }

  return false;
}

export function mcpUsageOf(trial: Trial): McpUsage {
  const summary = trial.transcript?.summary;
  if (!summary) {
    return {
      applicable: false,
      totalCalls: 0,
      byTool: {},
      byServer: {},
      firstCall: null,
      delegated: null,
    };
  }

  const byTool = summary.mcpToolCalls ?? {};
  const byServer: Record<string, number> = {};
  for (const [tool, count] of Object.entries(byTool)) {
    const server = serverOf(tool);
    byServer[server] = (byServer[server] ?? 0) + count;
  }

  return {
    applicable: true,
    totalCalls: summary.mcpToolCallCount ?? 0,
    byTool,
    byServer,
    firstCall: Object.keys(byTool)[0] ?? null,
    delegated: delegationOf(trial),
  };
}

/**
 * Did the agent go around the protocol and read the servers off disk?
 *
 * This is what actually happened in the first full matrix (D-26): with the MCP
 * tools unavailable, the agent found the staged servers, `cat`-ed
 * `dist/tools.js`, and then ran
 * `node -e "import('./handlers.js').then(h => h.handleGetUiBuildingInstructions())"`.
 * Every quality gain in that matrix came through that channel, and the run
 * reported it as an MCP win.
 *
 * Only *tool inputs* are scanned, never tool results. The agent is free to read
 * `.mcp.json`, which names the runtime directory in its output — that is
 * configuration, not payload, and flagging it would make the check useless.
 *
 * Returns the offending command, or null.
 */
/**
 * How the agent touched the staging directory.
 *
 * `read` means content came out: `cat dist/tools.js`, or `cd` into the tree
 * followed by anything at all. That is the D-26 channel, and it invalidates the
 * trial — the agent obtained through the filesystem what the protocol was
 * supposed to deliver.
 *
 * `list` means paths came out and nothing else: `find`, `ls`, `Glob`. Worth
 * reporting — the agent was looking for something to copy — but a directory
 * listing feeds no grader, so it does not invalidate a measurement.
 */
export type StagingLeak = { kind: "read" | "list"; input: string };

/** Commands that can emit file *contents*, as opposed to paths. */
const CONTENT_VERBS =
  /^(cat|head|tail|less|more|nl|od|xxd|strings|sed|awk|grep|egrep|fgrep|rg|ack|jq|node|python3?|sh|bash|source|\.)$/;

/** Tools whose output is a path list rather than file contents. */
const ENUMERATING_TOOLS = /^(glob|ls)$/i;

/**
 * Paths and endpoints that would mean the agent went around the protocol.
 *
 * The first two are historical: since ADR 55 the servers run on the host over
 * HTTP and no server file enters the sandbox, so there is nothing at either
 * path to find. They stay because a future change that reintroduces staging
 * without reintroducing detection would be silent, and silence is how D-26 cost
 * a full matrix.
 *
 * The third is live. The one thing the sandbox still knows is the URL in
 * `.mcp.json`, and an agent that curls it, or POSTs raw JSON-RPC to it with
 * `node -e`, gets the servers' answers without any of it appearing as a tool
 * call. That is a smaller hole than the old one — it yields what the tools
 * yield, not the token files themselves — but it would still make an arm look
 * like it never reached its MCP while being fully informed by it.
 */
function touchesStaging(text: string): boolean {
  return (
    text.includes(MCP_RUNTIME_DIR_NAME) ||
    text.includes(MCP_UPLOAD_DIR) ||
    MCP_ENDPOINT.test(text)
  );
}

/**
 * The host-side endpoint, matched by shape rather than by address: the bridge
 * gateway is discovered per container and the ports may move.
 */
const MCP_ENDPOINT = /https?:\/\/[\d.]+:\d+\/mcp\b/;

/**
 * Classify one shell command.
 *
 * Segment-wise rather than whole-string, because `find <dir> | head -50` pipes
 * a *path list* into `head` — scanning the whole string for content verbs would
 * call that a read. A verb only counts when it is applied to the staging path
 * itself. `cd <dir> && …` counts unconditionally: everything after it is
 * relative to the tree, which is exactly how the first matrix was compromised.
 */
function classifyCommand(command: string): "read" | "list" {
  for (const raw of command.split(/\||;|&&|\n/)) {
    const segment = raw.trim();
    if (!touchesStaging(segment)) continue;

    const verb = (segment.match(/^\S+/)?.[0] ?? "").replace(/^.*\//, "");
    if (verb === "cd" || CONTENT_VERBS.test(verb)) return "read";
    if (/-exec\b|-delete\b|\$\(|`/.test(segment)) return "read";
  }
  return "list";
}

function classifyBlock(name: string, input: string): "read" | "list" {
  if (ENUMERATING_TOOLS.test(name)) return "list";
  if (!/^bash$/i.test(name)) return "read"; // Read, Grep, and anything unknown

  try {
    const parsed = JSON.parse(input) as { command?: unknown };
    if (typeof parsed.command === "string") {
      return classifyCommand(parsed.command);
    }
  } catch {
    // fall through
  }
  return "read";
}

export function stagingLeakOf(trial: Trial): StagingLeak | null {
  const raw = readRawTranscript(trial);
  if (!raw) return null;

  let enumeration: StagingLeak | null = null;

  for (const line of raw.split("\n")) {
    if (!touchesStaging(line)) {
      continue; // cheap reject before paying for JSON.parse
    }

    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const content = (entry as { message?: { content?: unknown } })?.message
      ?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (
        !block ||
        typeof block !== "object" ||
        (block as { type?: string }).type !== "tool_use"
      ) {
        continue;
      }

      const input = JSON.stringify((block as { input?: unknown }).input ?? {});
      if (!touchesStaging(input)) continue;

      const name = String((block as { name?: unknown }).name ?? "");
      const kind = classifyBlock(name, input);
      const leak: StagingLeak = {
        kind,
        input: input.length > 300 ? `${input.slice(0, 300)}\u2026` : input,
      };

      // A single read outranks any number of listings, so report it
      // immediately and keep the first listing only as a fallback.
      if (kind === "read") return leak;
      enumeration ??= leak;
    }
  }

  return enumeration;
}

export function mcpUsage(trial: Trial): GraderResult {
  const usage = mcpUsageOf(trial);
  if (!usage.applicable) {
    return notApplicable(
      "mcp-usage",
      "contract",
      "no transcript captured for this trial",
    );
  }
  if (trial.variant === "none") {
    return notApplicable(
      "mcp-usage",
      "contract",
      "baseline variant has no MCP servers",
    );
  }

  const servers = Object.entries(usage.byServer)
    .map(([name, count]) => `${name}=${count}`)
    .join(", ");

  const leak = stagingLeakOf(trial);
  const delegated = usage.delegated;

  return result("mcp-usage", "contract", [
    check(
      "reached-mcp",
      "the agent called its MCP servers",
      usage.totalCalls > 0 || delegated !== null,
      usage.totalCalls > 0
        ? `${usage.totalCalls} call(s): ${servers}${
            delegated ? " + delegated calls not counted" : ""
          }`
        : delegated
          ? `DELEGATED to a subagent (calls invisible): ${delegated.tools.join(", ")}`
          : "MCP servers were configured but never called",
    ),
    check(
      "consulted-first",
      "an MCP call preceded the first write",
      usage.firstCall !== null || delegated !== null,
      usage.firstCall
        ? `first: ${usage.firstCall}`
        : delegated
          ? "first call was delegated to a subagent"
          : undefined,
    ),
    check(
      "no-staging-leak",
      "the agent did not read the servers off disk",
      leak?.kind !== "read",
      leak?.kind === "read"
        ? `LEAK: bypassed the protocol via ${leak.input}`
        : undefined,
    ),
    check(
      "no-staging-enumeration",
      "the agent did not go looking for the servers on disk",
      leak === null,
      leak?.kind === "list"
        ? `ENUMERATED (no content read, trial still counts): ${leak.input}`
        : undefined,
    ),
  ]);
}

export function negativeUsage(trial: Trial): GraderResult {
  if (trial.variant !== "none") {
    return notApplicable(
      "negative-usage",
      "contract",
      "only meaningful for the no-MCP baseline",
    );
  }

  const usage = mcpUsageOf(trial);
  if (!usage.applicable) {
    return notApplicable(
      "negative-usage",
      "contract",
      "no transcript captured for this trial",
    );
  }

  const webTools = Object.keys(
    trial.transcript?.summary?.toolCalls ?? {},
  ).filter((name) => name.startsWith("Web"));

  return result("negative-usage", "contract", [
    check(
      "no-mcp-calls",
      "baseline reached no MCP server",
      usage.totalCalls === 0,
      usage.totalCalls > 0
        ? `LEAK: ${usage.totalCalls} MCP call(s) in a no-MCP variant`
        : undefined,
    ),
    check(
      "no-web-research",
      "baseline did no web research",
      webTools.length === 0,
      webTools.length
        ? `LEAK: ${webTools.join(", ")} — the control fetched external material`
        : undefined,
    ),
  ]);
}
