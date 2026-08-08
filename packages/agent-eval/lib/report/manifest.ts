/**
 * Everything one trial needs to be inspected, as a single JSON bundle.
 *
 * The report Storybook runs in a browser and cannot read `results/`. Rather
 * than teach it to fetch a dozen files, the host serves one manifest through a
 * virtual module (`lib/report/host/trial-plugin.ts`). This module builds it.
 *
 * The manifest is the *only* coupling between the harness and the report UI:
 * stories import `virtual:trial` and nothing else from `lib/`. That keeps the
 * report buildable from a results tree alone, which is what publication needs.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { discover } from "../graders/discover";
import {
  readRawTranscript,
  type Trial,
  type TranscriptMeta,
} from "../graders/trial";
import { collectTrial, type Outcome } from "./collect";

/** Tool payloads are unbounded; a transcript is not worth 40 MB of JSON. */
const MAX_TOOL_CHARS = 6_000;
const MAX_SOURCE_BYTES = 200_000;

/** Files that are evidence, not source the reviewer wants to read. */
const EXCLUDED_SOURCES = new Set([
  "package-lock.json",
  "agent-transcript.jsonl",
  "agent-transcript-meta.json",
  "toolchain-report.json",
  "runtime-report.json",
]);

const EXCLUDED_PREFIXES = [
  "vendor/",
  ".claude/",
  ".mcp-servers/",
  // The synced `--ks-*` layer. It is 248 KB of shipped fixture that no agent
  // wrote, and repeating it in all sixty reports would bury the handful of
  // files that are actually the trial's output.
  "src/token/",
];

export interface ManifestToolCall {
  id: string;
  name: string;
  /** MCP server name when the call was attributed to one, else null. */
  server: string | null;
  input: string;
  truncated: boolean;
}

export interface ManifestToolResult {
  id: string;
  output: string;
  isError: boolean;
  truncated: boolean;
}

export interface ManifestTurn {
  index: number;
  role: "user" | "assistant" | "system";
  timestamp: string | null;
  text: string;
  toolCalls: ManifestToolCall[];
  toolResults: ManifestToolResult[];
}

/** The component under test, located by role rather than by name. */
export interface ManifestComponent {
  slug: string;
  dir: string;
  /** Project-relative path to the implementation, or null if none was written. */
  componentPath: string | null;
  componentOnContract: boolean;
  stylePath: string | null;
  tokenPath: string | null;
  clientPaths: string[];
  schemaPath: string | null;
  storyPaths: string[];
  /** Parsed schema, used to derive Storybook controls. */
  schema: JsonSchema | null;
  /** Source of the `*Defaults` module, used as story args. */
  defaultsPath: string | null;
}

export interface JsonSchema {
  title?: string;
  description?: string;
  required?: string[];
  properties?: Record<
    string,
    {
      type?: string | string[];
      title?: string;
      description?: string;
      enum?: unknown[];
      default?: unknown;
    }
  >;
}

export interface TrialManifest {
  /** `<experiment>/<timestamp>/<eval>/run-N` — stable, and the CLI's address. */
  id: string;
  experiment: string;
  variant: string;
  timestamp: string;
  evalName: string;
  run: number;
  model: string | null;
  /** The task exactly as the agent received it. */
  prompt: string | null;
  outcome: Outcome;
  transcript: TranscriptMeta | null;
  component: ManifestComponent;
  sources: Array<{ path: string; contents: string }>;
  conversation: ManifestTurn[];
  /** Raw toolchain/runtime output, keyed by a display name. */
  outputs: Record<string, string>;
}

function truncate(value: string, limit: number): [string, boolean] {
  if (value.length <= limit) return [value, false];
  return [
    `${value.slice(0, limit)}\n\n… truncated, ${value.length - limit} more characters`,
    true,
  ];
}

function stringifyToolPayload(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface TranscriptRecord {
  type?: string;
  timestamp?: string;
  attributionMcpServer?: string;
  message?: {
    role?: string;
    content?:
      | string
      | Array<{
          type?: string;
          text?: string;
          id?: string;
          name?: string;
          input?: unknown;
          tool_use_id?: string;
          content?: unknown;
          is_error?: boolean;
        }>;
  };
}

/**
 * Normalise Claude Code's JSONL into turns the UI can render.
 *
 * The on-disk format carries a lot that only matters to the CLI — session ids,
 * parent uuids, sidechain flags. Everything a reviewer asks of a transcript is
 * "what was said, what was called, what came back", so that is what survives.
 */
export function parseConversation(raw: string | null): ManifestTurn[] {
  if (!raw) return [];

  const turns: ManifestTurn[] = [];

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;

    let record: TranscriptRecord;
    try {
      record = JSON.parse(line) as TranscriptRecord;
    } catch {
      continue;
    }

    const message = record.message;
    if (!message?.role) continue;

    const role =
      message.role === "assistant"
        ? "assistant"
        : message.role === "user"
          ? "user"
          : "system";

    const turn: ManifestTurn = {
      index: turns.length,
      role,
      timestamp: record.timestamp ?? null,
      text: "",
      toolCalls: [],
      toolResults: [],
    };

    if (typeof message.content === "string") {
      turn.text = message.content;
    } else if (Array.isArray(message.content)) {
      const texts: string[] = [];

      for (const block of message.content) {
        if (block.type === "text" && block.text) {
          texts.push(block.text);
          continue;
        }

        if (block.type === "tool_use") {
          const [input, truncated] = truncate(
            stringifyToolPayload(block.input),
            MAX_TOOL_CHARS,
          );
          turn.toolCalls.push({
            id: block.id ?? "",
            name: block.name ?? "unknown",
            server: record.attributionMcpServer ?? null,
            input,
            truncated,
          });
          continue;
        }

        if (block.type === "tool_result") {
          const [output, truncated] = truncate(
            stringifyToolPayload(block.content),
            MAX_TOOL_CHARS,
          );
          turn.toolResults.push({
            id: block.tool_use_id ?? "",
            output,
            isError: block.is_error === true,
            truncated,
          });
        }
      }

      turn.text = texts.join("\n\n");
    }

    // A turn that carried neither prose nor a call is bookkeeping.
    if (!turn.text && !turn.toolCalls.length && !turn.toolResults.length) {
      continue;
    }

    turns.push(turn);
  }

  return turns;
}

function parseSchema(contents: string | undefined): JsonSchema | null {
  if (!contents) return null;
  try {
    return JSON.parse(contents) as JsonSchema;
  } catch {
    return null;
  }
}

function describeComponent(trial: Trial): ManifestComponent {
  const found = discover(trial);
  const { slug, dir } = trial.target;

  const storyPaths = [...trial.files.keys()].filter(
    (path) => path.startsWith(dir) && /\.stories\.[jt]sx?$/.test(path),
  );

  const defaultsPath =
    [...trial.files.keys()].find(
      (path) => path.startsWith(dir) && /Defaults\.[jt]s$/.test(path),
    ) ?? null;

  // `discover()` already returns project-relative paths — joining `dir` again
  // silently produces `src/components/x/src/components/x/…`, which reads as a
  // plausible path and resolves to nothing.
  return {
    slug,
    dir,
    componentPath: found.component,
    componentOnContract: found.componentOnContract,
    stylePath: found.styles,
    tokenPath: found.tokens,
    clientPaths: found.client,
    schemaPath: found.schema,
    storyPaths,
    schema: parseSchema(
      found.schema ? trial.files.get(found.schema) : undefined,
    ),
    defaultsPath,
  };
}

function collectSources(trial: Trial): Array<{
  path: string;
  contents: string;
}> {
  return [...trial.files.entries()]
    .filter(([path]) => {
      if (EXCLUDED_SOURCES.has(path)) return false;
      return !EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
    })
    .filter(([, contents]) => contents.length <= MAX_SOURCE_BYTES)
    .map(([path, contents]) => ({ path, contents }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function collectOutputs(trial: Trial): Record<string, string> {
  const outputs: Record<string, string> = {};

  if (trial.evalOutput) outputs["eval.txt"] = trial.evalOutput;

  for (const name of ["toolchain-report.json", "runtime-report.json"]) {
    const path = join(trial.projectDir, name);
    if (existsSync(path)) outputs[name] = readFileSync(path, "utf-8");
  }

  const graderDir = join(trial.runDir, "outputs");
  for (const name of ["build.txt", "typecheck.txt", "lint.txt", "a11y.txt"]) {
    const path = join(graderDir, name);
    if (existsSync(path)) outputs[name] = readFileSync(path, "utf-8");
  }

  return outputs;
}

export function trialId(trial: Trial): string {
  return `${trial.experiment}/${trial.timestamp}/${trial.evalName}/run-${trial.run}`;
}

export function buildManifest(trial: Trial): TrialManifest {
  return {
    id: trialId(trial),
    experiment: trial.experiment,
    variant: trial.variant,
    timestamp: trial.timestamp,
    evalName: trial.evalName,
    run: trial.run,
    model: trial.model,
    prompt: trial.files.get("PROMPT.md") ?? null,
    outcome: collectTrial(trial),
    transcript: trial.transcript,
    component: describeComponent(trial),
    sources: collectSources(trial),
    conversation: parseConversation(readRawTranscript(trial)),
    outputs: collectOutputs(trial),
  };
}
