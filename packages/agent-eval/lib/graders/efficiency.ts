/**
 * Efficiency metrics (G2).
 *
 * Not a grader: nothing here passes or fails. These are the numbers that make
 * "the MCP helped" an economic statement rather than an aesthetic one — an MCP
 * that lifts quality while tripling turns and doubling context is not obviously
 * worth shipping, and only the report can show that.
 */

import { readRawTranscript, type Trial } from "./trial";

export interface Efficiency {
  available: boolean;
  /** Assistant messages — a proxy for turns. */
  turns: number;
  toolCalls: number;
  shellCommands: number;
  filesRead: number;
  fileWrites: number;
  /**
   * Writes to a file that had already been written in the same trial. High
   * rework means the agent guessed, checked, and corrected — exactly what
   * good guidance should eliminate.
   */
  rework: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  /** Tokens returned by MCP tools — the context price of the server. */
  mcpResultTokens: number;
}

const EMPTY: Efficiency = {
  available: false,
  turns: 0,
  toolCalls: 0,
  shellCommands: 0,
  filesRead: 0,
  fileWrites: 0,
  rework: 0,
  tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  mcpResultTokens: 0,
};

/** Rough token estimate; only ever compared against itself across variants. */
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

/**
 * Tokens and turns, counted per *message* rather than per transcript line.
 *
 * Claude Code writes one line per content block, and every line of a message
 * repeats that message's `usage` verbatim. The in-sandbox summariser
 * (`lib/eval-harness/harness.ts`) adds them up line by line, so its `tokens`
 * and `assistantMessages` are inflated by however many blocks the message
 * happened to contain — measured at 98 lines across 50 messages on one trial,
 * and $3.28 against a $1.51 invoice.
 *
 * The error is not a constant: blocks per message is a function of how many
 * tools the agent called, so the arms that call MCP tools inflate hardest, in
 * the direction that flatters what an MCP appears to cost. D-147 fixed exactly
 * this in `bin/cost.ts` and left it live here — which is the path the report,
 * and therefore every headline USD/task figure, actually uses.
 *
 * Recomputed host-side rather than in the sandbox so it applies retroactively
 * to every trial already bought (D-50). `toolCalls` is deliberately *not*
 * recomputed: one block per line means the summariser's per-line count of
 * `tool_use` blocks is already correct, and deduplicating those would
 * undercount them badly (49 calls read as 3).
 */
function perMessageTotals(raw: string): {
  tokens: Efficiency["tokens"];
  turns: number;
} {
  const seen = new Set<string>();
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let turns = 0;
  let anonymous = 0;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let event: {
      message?: {
        id?: unknown;
        role?: unknown;
        usage?: Record<string, unknown>;
      };
    };
    try {
      event = JSON.parse(line) as typeof event;
    } catch {
      continue;
    }

    const message = event?.message;
    if (message?.role !== "assistant") continue;

    // A line without an id is its own message rather than a dropped one: an
    // unfamiliar transcript shape should over-count, not silently vanish.
    const id =
      typeof message.id === "string" ? message.id : `anonymous-${anonymous++}`;
    if (seen.has(id)) continue;
    seen.add(id);
    turns += 1;

    const usage = message.usage;
    if (!usage) continue;
    const num = (value: unknown) => (typeof value === "number" ? value : 0);
    tokens.input += num(usage.input_tokens);
    tokens.output += num(usage.output_tokens);
    tokens.cacheRead += num(usage.cache_read_input_tokens);
    tokens.cacheWrite += num(usage.cache_creation_input_tokens);
  }

  return { tokens, turns };
}

export function efficiencyOf(trial: Trial): Efficiency {
  const summary = trial.transcript?.summary;
  if (!summary) return EMPTY;

  const toolCalls = Object.values(summary.toolCalls ?? {}).reduce(
    (a, b) => a + b,
    0,
  );

  const efficiency: Efficiency = {
    available: true,
    turns: summary.assistantMessages ?? 0,
    toolCalls,
    shellCommands: summary.toolCalls?.Bash ?? 0,
    filesRead: summary.toolCalls?.Read ?? 0,
    fileWrites:
      (summary.toolCalls?.Write ?? 0) + (summary.toolCalls?.Edit ?? 0),
    rework: 0,
    tokens: summary.tokens,
    mcpResultTokens: 0,
  };

  const raw = readRawTranscript(trial);
  if (!raw) return efficiency;

  const { tokens, turns } = perMessageTotals(raw);
  efficiency.tokens = tokens;
  efficiency.turns = turns;

  const written = new Set<string>();
  const mcpToolUseIds = new Set<string>();
  let rework = 0;
  let mcpResultTokens = 0;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    const content = (event as { message?: { content?: unknown } })?.message
      ?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content as Array<Record<string, unknown>>) {
      if (block.type === "tool_use") {
        const name = String(block.name ?? "");
        if (name.startsWith("mcp__") && typeof block.id === "string") {
          mcpToolUseIds.add(block.id);
        }
        if (name === "Write" || name === "Edit") {
          const path = (block.input as { file_path?: string })?.file_path;
          if (typeof path === "string") {
            if (written.has(path)) rework += 1;
            written.add(path);
          }
        }
      }

      if (
        block.type === "tool_result" &&
        typeof block.tool_use_id === "string" &&
        mcpToolUseIds.has(block.tool_use_id)
      ) {
        const payload =
          typeof block.content === "string"
            ? block.content
            : JSON.stringify(block.content ?? "");
        mcpResultTokens += estimateTokens(payload);
      }
    }
  }

  return { ...efficiency, rework, mcpResultTokens };
}
