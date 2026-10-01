/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Built from lib/eval-harness/sources/<name>.ts + lib/eval-harness/harness.ts
 * by bin/build-evals.ts. Run `pnpm build:evals` after changing either.
 *
 * Committed on purpose: the experiment fingerprint hashes the eval directory as
 * it sits on disk. The sources live outside evals/ because everything in a
 * fixture except EVAL.ts and PROMPT.md is uploaded to the sandbox.
 */

// lib/eval-harness/sources/880-contract-lookup.ts
import {
  existsSync as existsSync2,
  readFileSync as readFileSync2,
} from "node:fs";
import { expect, test } from "vitest";

// lib/eval-harness/harness.ts
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
var TRANSCRIPT_FILE = "agent-transcript.jsonl";
var TRANSCRIPT_META_FILE = "agent-transcript-meta.json";
var SUBAGENT_TRANSCRIPT_FILE = "agent-subagent-transcripts.jsonl";
var MAX_SUBAGENT_BYTES = 4e6;
var requireCjs = createRequire(import.meta.url);
function newestJsonlUnder(dir, depth = 0) {
  if (depth > 4 || !existsSync(dir)) return null;
  let best = null;
  let entries = [];
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
function summarise(raw) {
  const toolCalls = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let assistantMessages = 0;
  let observedModel = null;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let event;
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
    for (const block of Array.isArray(message?.content)
      ? message.content
      : []) {
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
function findTaskDirs(dir, depth = 0, out = []) {
  if (depth > 5 || !existsSync(dir)) return out;
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
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
    if (!stats.isDirectory()) continue;
    if (entry === "tasks") out.push(full);
    else findTaskDirs(full, depth + 1, out);
  }
  return out;
}
function collectSubagentTranscripts(encodedCwd) {
  const roots = [];
  try {
    for (const entry of readdirSync("/tmp")) {
      if (entry.startsWith("claude-")) roots.push(join("/tmp", entry));
    }
  } catch {}
  const taskDirs = [];
  for (const root of roots) {
    const scoped = join(root, encodedCwd);
    findTaskDirs(existsSync(scoped) ? scoped : root, 0, taskDirs);
  }
  const agents = [];
  const lines = [];
  let bytes = 0;
  let truncated = false;
  for (const taskDir of taskDirs) {
    let entries = [];
    try {
      entries = readdirSync(taskDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".output")) continue;
      let raw;
      try {
        raw = readFileSync(join(taskDir, entry), "utf-8");
      } catch {
        continue;
      }
      if (bytes + raw.length > MAX_SUBAGENT_BYTES) {
        truncated = true;
        continue;
      }
      bytes += raw.length;
      lines.push(
        raw.endsWith("\n")
          ? raw
          : `${raw}
`,
      );
      agents.push({
        agentId: entry.replace(/\.output$/, ""),
        bytes: raw.length,
        summary: summarise(raw),
      });
    }
  }
  if (lines.length) writeFileSync(SUBAGENT_TRANSCRIPT_FILE, lines.join(""));
  const mcpToolCalls = {};
  const toolCalls = {};
  for (const agent of agents) {
    const summary = agent.summary;
    for (const [name, n] of Object.entries(summary.toolCalls)) {
      toolCalls[name] = (toolCalls[name] ?? 0) + n;
    }
    for (const [name, n] of Object.entries(summary.mcpToolCalls)) {
      mcpToolCalls[name] = (mcpToolCalls[name] ?? 0) + n;
    }
  }
  return {
    searchedRoots: roots,
    taskDirs,
    count: agents.length,
    bytes,
    truncated,
    agents,
    toolCalls,
    mcpToolCalls,
    mcpToolCallCount: Object.values(mcpToolCalls).reduce((a, b) => a + b, 0),
  };
}
function captureTranscript() {
  try {
    const cwd = process.cwd();
    const encodedCwd = cwd.replace(/\//g, "-");
    const roots = ["/home/node", "/root", "/home/sandbox", "/home/user"];
    const home = homedir();
    if (home && !roots.includes(home)) roots.unshift(home);
    const searched = roots.map((root) =>
      join(root, ".claude", "projects", encodedCwd),
    );
    let found = null;
    for (const dir of searched) {
      const candidate = newestJsonlUnder(dir);
      if (candidate && (!found || candidate.mtime > found.mtime)) {
        found = candidate;
      }
    }
    if (!found) {
      for (const root of roots) {
        const candidate = newestJsonlUnder(join(root, ".claude"));
        if (candidate && (!found || candidate.mtime > found.mtime)) {
          found = candidate;
        }
      }
    }
    const meta = {
      cwd,
      encodedCwd,
      roots,
      searched,
      found: Boolean(found),
      sourcePath: found?.path ?? null,
    };
    if (found) {
      const raw = readFileSync(found.path, "utf-8");
      writeFileSync(TRANSCRIPT_FILE, raw);
      meta.bytes = raw.length;
      meta.summary = summarise(raw);
    }
    meta.subagents = collectSubagentTranscripts(encodedCwd);
    writeFileSync(TRANSCRIPT_META_FILE, JSON.stringify(meta, null, 2));
  } catch {}
}

// lib/eval-harness/sources/880-contract-lookup.ts
captureTranscript();
var ANSWERS = "answers.json";
var QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];
test("every question is answered", () => {
  expect(
    existsSync2(ANSWERS),
    `${ANSWERS} was not written at the repository root`,
  ).toBe(true);
  const parsed = JSON.parse(readFileSync2(ANSWERS, "utf-8"));
  expect(typeof parsed, `${ANSWERS} is not a JSON object`).toBe("object");
  for (const id of QUESTIONS) {
    const value = parsed[id];
    expect(
      value !== void 0 &&
        value !== null &&
        (Array.isArray(value) ? value.length > 0 : String(value).trim() !== ""),
      `${id} is unanswered`,
    ).toBe(true);
  }
});
