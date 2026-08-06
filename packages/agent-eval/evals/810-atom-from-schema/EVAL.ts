/**
 * 810-atom-from-schema — deterministic design-system contract checks.
 *
 * P0 scope: only assertions that are cheap, deterministic and directly express
 * the kickstartDS component contract. Toolchain, runtime and judge dimensions
 * land in P1–P3.
 *
 * Deliberately no post-run `scripts`: build/typecheck run from here (P1) so a
 * sandbox hiccup can be classified as infrastructure rather than counted as a
 * model failure.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { test, expect } from "vitest";

/* ────────────────────────── transcript capture ──────────────────────────────
 * `@vercel/agent-eval` captures the Claude Code transcript from a single
 * hard-coded path (`~/.claude/projects/<cwd-with-dashes>/*.jsonl`) and silently
 * yields `null` on any miss — which is what happened on our first real run
 * (`transcript: null`, `observedModel: null`, no `transcript.json` on disk).
 *
 * Cost, efficiency and MCP-usage are three of the four dimensions this package
 * exists to measure, and all three are read out of the transcript, so we cannot
 * depend on that. This block searches every plausible home root, copies the raw
 * JSONL into the workspace, and writes a small summary next to it. Both files
 * are untracked, so `git add . && git diff HEAD` picks them up and they land in
 * `results/<experiment>/<ts>/<eval>/run-N/project/`.
 *
 * This lives in EVAL.ts on purpose. EVAL.ts is withheld from the agent (see
 * TEST_FILE_PATTERNS); a shared helper file would be uploaded alongside the
 * fixture and would tell the agent we read its tool calls — an observer effect
 * on the very metric we are trying to measure. Duplicated per fixture until
 * there are enough fixtures to justify generating it.
 *
 * Nothing here asserts. A missing transcript is an infrastructure problem and
 * must never be scored as a model failure.
 * ────────────────────────────────────────────────────────────────────────── */

const TRANSCRIPT_FILE = "agent-transcript.jsonl";
const TRANSCRIPT_META_FILE = "agent-transcript-meta.json";

function newestJsonlUnder(dir: string, depth = 0): { path: string; mtime: number } | null {
  if (depth > 4 || !existsSync(dir)) return null;
  let best: { path: string; mtime: number } | null = null;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    const candidate = stats.isDirectory()
      ? newestJsonlUnder(full, depth + 1)
      : entry.endsWith(".jsonl")
        ? { path: full, mtime: stats.mtimeMs }
        : null;
    if (candidate && (!best || candidate.mtime > best.mtime)) best = candidate;
  }
  return best;
}

/** Token totals + a tool-call histogram, so P1 graders do not re-parse the JSONL. */
function summarise(raw: string) {
  const toolCalls: Record<string, number> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let assistantMessages = 0;
  let observedModel: string | null = null;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const message = event?.message;
    if (typeof message?.model === "string") observedModel = message.model;
    if (message?.role === "assistant") assistantMessages += 1;
    const usage = message?.usage;
    if (usage) {
      inputTokens += usage.input_tokens ?? 0;
      outputTokens += usage.output_tokens ?? 0;
      cacheReadTokens += usage.cache_read_input_tokens ?? 0;
      cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
    }
    for (const block of Array.isArray(message?.content) ? message.content : []) {
      if (block?.type === "tool_use" && typeof block.name === "string") {
        toolCalls[block.name] = (toolCalls[block.name] ?? 0) + 1;
      }
    }
  }

  const mcpToolCalls = Object.fromEntries(
    Object.entries(toolCalls).filter(([name]) => name.startsWith("mcp__")),
  );

  return {
    observedModel,
    assistantMessages,
    tokens: {
      input: inputTokens,
      output: outputTokens,
      cacheRead: cacheReadTokens,
      cacheWrite: cacheWriteTokens,
    },
    toolCalls,
    mcpToolCalls,
    mcpToolCallCount: Object.values(mcpToolCalls).reduce((a, b) => a + b, 0),
  };
}

function captureTranscript(): void {
  const cwd = process.cwd();
  const encodedCwd = cwd.replace(/\//g, "-");
  const roots = Array.from(
    new Set(
      [process.env.HOME, homedir(), "/root", "/home/sandbox", "/home/user", "/home/node"].filter(
        (root): root is string => Boolean(root),
      ),
    ),
  );

  const searched: string[] = [];
  let found: { path: string; mtime: number } | null = null;

  // Preferred location first: the exact per-project directory Claude Code uses.
  for (const root of roots) {
    const exact = join(root, ".claude", "projects", encodedCwd);
    searched.push(exact);
    const candidate = newestJsonlUnder(exact);
    if (candidate && (!found || candidate.mtime > found.mtime)) found = candidate;
  }

  // Fallback: anything JSONL under a `.claude` directory, newest wins.
  if (!found) {
    for (const root of roots) {
      const claudeDir = join(root, ".claude");
      searched.push(claudeDir);
      const candidate = newestJsonlUnder(claudeDir);
      if (candidate && (!found || candidate.mtime > found.mtime)) found = candidate;
    }
  }

  const meta: Record<string, unknown> = { cwd, encodedCwd, roots, searched, found: false };

  if (found) {
    try {
      const raw = readFileSync(found.path, "utf-8");
      writeFileSync(TRANSCRIPT_FILE, raw);
      meta.found = true;
      meta.sourcePath = found.path;
      meta.bytes = raw.length;
      meta.summary = summarise(raw);
    } catch (error) {
      meta.error = error instanceof Error ? error.message : String(error);
    }
  }

  try {
    writeFileSync(TRANSCRIPT_META_FILE, JSON.stringify(meta, null, 2));
  } catch {
    // Never let diagnostics break validation.
  }
}

captureTranscript();

const DIR = "src/components/badge";

const FILES = {
  component: `${DIR}/BadgeComponent.tsx`,
  styles: `${DIR}/BadgeComponent.scss`,
  client: `${DIR}/BadgeComponent.client.ts`,
  schema: `${DIR}/badge.schema.json`,
} as const;

function read(path: string): string {
  return readFileSync(path, "utf-8");
}

test("component file follows the {Name}Component.tsx contract", () => {
  expect(existsSync(FILES.component)).toBe(true);
});

test("styles file follows the {Name}Component.scss contract", () => {
  expect(existsSync(FILES.styles)).toBe(true);
});

test("client behaviour file follows the {Name}Component.client.ts contract", () => {
  expect(existsSync(FILES.client)).toBe(true);
});

test("the provided schema is left untouched", () => {
  const schema = JSON.parse(read(FILES.schema));
  expect(Object.keys(schema.properties).sort()).toEqual([
    "dismissible",
    "icon",
    "label",
    "size",
    "variant",
  ]);
});

test("component is pure — no React state or effects", () => {
  const source = read(FILES.component);
  for (const hook of [
    "useState",
    "useReducer",
    "useEffect",
    "useLayoutEffect",
  ]) {
    expect(source).not.toContain(hook);
  }
});

test("component forwards its ref", () => {
  expect(read(FILES.component)).toContain("forwardRef");
});

test("dismiss behaviour is implemented client-side, not in React", () => {
  // The contract puts interactivity in the vanilla-JS client file. An empty
  // stub next to an interactive React component would pass the existence check
  // above while violating the contract entirely.
  const client = read(FILES.client);
  expect(client.trim().length).toBeGreaterThan(0);
  expect(client).toMatch(/addEventListener/);
});

test("styles use design tokens rather than literal colour values", () => {
  const styles = read(FILES.styles);
  const literals = styles.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) ?? [];
  expect(literals).toEqual([]);
  expect(styles).toMatch(/var\(--/);
});
