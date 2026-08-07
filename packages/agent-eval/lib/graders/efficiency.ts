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
