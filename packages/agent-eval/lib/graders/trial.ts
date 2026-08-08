/**
 * Loading trials back off disk.
 *
 * Everything the graders need comes from the persisted run artifacts, which is
 * what makes re-grading free: fixing a grader bug costs a `pnpm grade`, not
 * another paid run. That property is load-bearing — the P0 rubric shipped with
 * two wrong file names, and re-grading is the only reason that mistake did not
 * cost three more trials to correct.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { targetFor, type Target } from "./targets";
import type { VariantKey } from "../mcp/variants";

const PACKAGE_ROOT = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
);

export const RESULTS_ROOT = join(PACKAGE_ROOT, "results");

/** Fixtures as checked in, for telling an agent's edits from what it was given. */
const EVALS_ROOT = join(PACKAGE_ROOT, "evals");

/** Extensions worth reading into memory. Screenshots and binaries are skipped. */
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonl",
  ".scss",
  ".sass",
  ".css",
  ".md",
  ".mdx",
  ".html",
  ".txt",
  ".yml",
  ".yaml",
]);

const SKIP_DIRS = new Set(["node_modules", ".git", ".mcp-servers", "dist"]);

export interface TranscriptSummary {
  observedModel: string | null;
  assistantMessages: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  toolCalls: Record<string, number>;
  mcpToolCalls: Record<string, number>;
  mcpToolCallCount: number;
}

export interface TranscriptMeta {
  found: boolean;
  sourcePath?: string;
  bytes?: number;
  summary?: TranscriptSummary;
  searched?: string[];
  error?: string;
}

export interface Trial {
  experiment: string;
  variant: VariantKey | "unknown";
  timestamp: string;
  evalName: string;
  run: number;
  runDir: string;
  projectDir: string;
  /** Project-relative path → file contents. */
  files: Map<string, string>;
  status: string;
  /** Wall-clock seconds. */
  duration: number;
  model: string | null;
  /** vitest output from the validation step, used by the failure classifier. */
  evalOutput: string | null;
  transcript: TranscriptMeta | null;
  target: Target;
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function readProjectFiles(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  if (!existsSync(dir)) return files;

  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(current, entry);
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        walk(full);
        continue;
      }
      const dot = entry.lastIndexOf(".");
      const ext = dot === -1 ? "" : entry.slice(dot);
      if (!TEXT_EXTENSIONS.has(ext)) continue;
      // The raw transcript is ~400 KB of JSONL and is read on demand instead.
      if (entry === "agent-transcript.jsonl") continue;
      try {
        files.set(
          relative(dir, full).split("\\").join("/"),
          readFileSync(full, "utf-8"),
        );
      } catch {
        // Unreadable file: treat as absent rather than aborting the load.
      }
    }
  };

  walk(dir);
  return files;
}

const VARIANT_KEYS: VariantKey[] = [
  "none",
  "component-builder",
  "design-tokens",
  "both",
];

/**
 * Which MCP set an experiment ran with.
 *
 * Prefers the marker `defineExperiment()` writes, because it is authoritative.
 * Falls back to the experiment name, longest key first so `component-builder`
 * is not shadowed by a shorter key.
 */
function variantOf(experiment: string): VariantKey | "unknown" {
  const marker = join(RESULTS_ROOT, experiment, ".variant-version");
  if (existsSync(marker)) {
    // Line 1 is `variant:hash`; the rest is the per-input breakdown.
    const stamp = readFileSync(marker, "utf-8").split("\n")[0] ?? "";
    const key = stamp.split(":")[0]?.trim();
    if (key && (VARIANT_KEYS as string[]).includes(key)) {
      return key as VariantKey;
    }
  }
  const byName = [...VARIANT_KEYS]
    .sort((a, b) => b.length - a.length)
    .find((key) => experiment.includes(`-${key}-`));
  return byName ?? "unknown";
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((entry) => {
    try {
      return statSync(join(dir, entry)).isDirectory();
    } catch {
      return false;
    }
  });
}

/** All timestamped run directories for an experiment, newest last. */
export function listRuns(experiment: string): string[] {
  return listDirs(join(RESULTS_ROOT, experiment)).sort();
}

export function listExperiments(): string[] {
  return listDirs(RESULTS_ROOT).sort();
}

/** One eval's results, wherever they happen to live. */
export interface MatrixEntry {
  evalName: string;
  timestamp: string;
  /** Eval files + config. Changes when either changes. */
  fingerprint: string | null;
  /** Eval files only. This is what has to agree across arms to compare them. */
  contentFingerprint: string | null;
}

/**
 * The current result set for an experiment, assembled across timestamps.
 *
 * A run only executes the evals whose fingerprint changed; everything else is
 * skipped and its results stay in the directory that produced them. So after
 * running incrementally, no single timestamp holds the whole matrix — the
 * newest one holds only whatever was last paid for.
 *
 * Reading one timestamp is therefore wrong as soon as more than one run has
 * happened, which is the normal state of this package. This mirrors the
 * framework's own dedupe rule (`housekeeping.js`): walk timestamps newest
 * first, take the first result seen per eval.
 */
export function resolveMatrix(experiment: string): MatrixEntry[] {
  const experimentDir = join(RESULTS_ROOT, experiment);
  const entries = new Map<string, MatrixEntry>();

  for (const timestamp of listRuns(experiment).reverse()) {
    for (const evalName of listDirs(join(experimentDir, timestamp))) {
      if (entries.has(evalName)) continue;

      const summary = readJson<{
        fingerprint?: string;
        contentFingerprint?: string;
      }>(join(experimentDir, timestamp, evalName, "summary.json"));

      entries.set(evalName, {
        evalName,
        timestamp,
        fingerprint: summary?.fingerprint ?? null,
        contentFingerprint: summary?.contentFingerprint ?? null,
      });
    }
  }

  return [...entries.values()].sort((a, b) =>
    a.evalName.localeCompare(b.evalName),
  );
}

/** Load every trial of one eval, from the timestamp that produced it. */
export function loadEval(
  experiment: string,
  timestamp: string,
  evalName: string,
): Trial[] {
  const target = targetFor(evalName);
  if (!target) return [];

  const variant = variantOf(experiment);
  const evalRoot = join(RESULTS_ROOT, experiment, timestamp, evalName);
  const trials: Trial[] = [];

  for (const runEntry of listDirs(evalRoot)) {
    const match = /^run-(\d+)$/.exec(runEntry);
    if (!match) continue;

    const runDir = join(evalRoot, runEntry);
    const projectDir = join(runDir, "project");
    const meta = readJson<{
      status?: string;
      duration?: number;
      model?: string;
    }>(join(runDir, "result.json"));
    const evalOutputPath = join(runDir, "outputs", "eval.txt");

    trials.push({
      experiment,
      variant,
      timestamp,
      evalName,
      run: Number(match[1]),
      runDir,
      projectDir,
      files: readProjectFiles(projectDir),
      status: meta?.status ?? "unknown",
      duration: meta?.duration ?? 0,
      model: meta?.model ?? null,
      evalOutput: existsSync(evalOutputPath)
        ? readFileSync(evalOutputPath, "utf-8")
        : null,
      transcript: readJson<TranscriptMeta>(
        join(projectDir, "agent-transcript-meta.json"),
      ),
      target,
    });
  }

  return trials.sort((a, b) => a.run - b.run);
}

/** Load every trial of one timestamped run. Evals without a target are skipped. */
export function loadRun(experiment: string, timestamp: string): Trial[] {
  return listDirs(join(RESULTS_ROOT, experiment, timestamp))
    .flatMap((evalName) => loadEval(experiment, timestamp, evalName))
    .sort((a, b) => a.run - b.run);
}

/** Load the current result set for an experiment, across timestamps. */
export function loadMatrix(experiment: string): Trial[] {
  return resolveMatrix(experiment)
    .flatMap((entry) => loadEval(experiment, entry.timestamp, entry.evalName))
    .sort((a, b) => a.evalName.localeCompare(b.evalName) || a.run - b.run);
}

/** The raw JSONL transcript, read on demand — it is far too large to hold per trial. */
export function readRawTranscript(trial: Trial): string | null {
  const path = join(trial.projectDir, "agent-transcript.jsonl");
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

/** Files directly inside a project directory (non-recursive). */
export function filesIn(trial: Trial, dir: string): string[] {
  const prefix = dir.endsWith("/") ? dir : `${dir}/`;
  return [...trial.files.keys()]
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length))
    .filter((rest) => !rest.includes("/"));
}

/** All files under a directory, at any depth. */
export function filesUnder(trial: Trial, dir: string): string[] {
  const prefix = dir.endsWith("/") ? dir : `${dir}/`;
  return [...trial.files.keys()]
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length));
}

export function readFile(trial: Trial, path: string): string | null {
  return trial.files.get(path) ?? null;
}

/**
 * Whether a file came out of the trial byte-identical to the fixture that went
 * in — i.e. the agent left it alone.
 *
 * Diff-style evals ship a working component and ask for a small change. Grading
 * the files the agent never touched measures the fixture's authoring, not the
 * agent's: `860`'s shipped stylesheet loses half of `style-placement` for using
 * a `@use` form the design system rarely uses, identically in all four arms.
 * See ADR 41 and `Target.diffTask`.
 */
export function untouched(trial: Trial, path: string): boolean {
  const produced = trial.files.get(path);
  if (produced === undefined) return false;

  const shipped = join(EVALS_ROOT, trial.evalName, path);
  if (!existsSync(shipped)) return false;

  return readFileSync(shipped, "utf-8") === produced;
}

/**
 * The fixture's own copy of a file, as shipped into the sandbox.
 *
 * Lets a grader separate what the agent authored from what it was handed. A
 * check that scores fixture-supplied content measures the fixture author, not
 * the system under test.
 */
export function readShipped(trial: Trial, path: string): string | null {
  const shipped = join(EVALS_ROOT, trial.evalName, path);
  if (!existsSync(shipped)) return null;

  return readFileSync(shipped, "utf-8");
}
