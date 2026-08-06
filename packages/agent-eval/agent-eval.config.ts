/**
 * Shared experiment defaults.
 *
 * See docs/internal/prd/ui-generation-eval-prd.md §5.4 and
 * docs/adr/adr-ui-generation-eval.md for the rationale behind each value.
 */

import type { AgentType, ModelTier } from "@vercel/agent-eval";

/**
 * The model every P0–P2 experiment runs against (D2).
 *
 * Pinned deliberately: comparing MCP variants across a moving model makes the
 * deltas meaningless. Overridable via env for local one-off probes only —
 * never for anything that writes a baseline.
 */
export const PRIMARY_MODEL: ModelTier = process.env.EVAL_MODEL ?? "sonnet";

/** Short label for the pinned model, used in experiment file names. */
export const PRIMARY_MODEL_LABEL = process.env.EVAL_MODEL_LABEL ?? "sonnet";

/** The agent under test (D2). Direct provider keys, no gateway (D3). */
export const PRIMARY_AGENT: AgentType = "claude-code";

/**
 * The pinned judge model (Decision 8).
 *
 * Changing this invalidates fingerprints and every historical comparison. It is
 * a changelog-worthy act, not a tweak. Unused until P3 — no eval calls a judge
 * matcher yet — but pinned from the start so the fingerprint never shifts
 * underneath us when the first judge assertion lands.
 */
export const JUDGE_MODEL: ModelTier = "opus";

export const DEFAULTS = {
  /**
   * 20 minutes. Raised from 15 after the first baseline run: the slowest
   * no-MCP trial took 653s against a 900s ceiling, and MCP variants can only be
   * slower (the token MCP alone can be a dozen roundtrips). A timeout kill
   * wastes the entire spend of a trial, so the ceiling is deliberately far
   * above the observed mean rather than close to it. `timeout` is part of the
   * fingerprint, so this invalidates cached results — done at the same time as
   * the EVAL.ts transcript-capture change, which invalidates them anyway.
   */
  timeout: 1200,

  /** Docker everywhere, local and CI (D4). No Vercel account required. */
  sandbox: "docker" as const,

  /**
   * MANDATORY, not a preference. G4 (static inspectable artifacts) is built on
   * the full project snapshot; 'changed' would lose the fixture context that
   * makes a generated component renderable.
   */
  copyFiles: "all" as const,

  /** EVAL.ts runs under vitest in-sandbox. */
  validation: "vitest" as const,

  /**
   * Post-run npm scripts are deliberately empty (Decision 12).
   *
   * Storybook found sandbox flakiness here produced more failures than real
   * agent mistakes. Build/typecheck/lint run from inside EVAL.ts instead, where
   * a tooling hiccup can be classified as `infra` rather than counted as a
   * model failure.
   */
  scripts: [] as string[],

  /**
   * CRITICAL: the framework default is `true`, which stops after the first
   * passing run. That would silently reduce every multi-run experiment to
   * pass@1-with-retries and make pass^k unmeasurable.
   */
  earlyExit: false,
} as const;

/** Runs per task, by suite (D9). */
export const RUNS = {
  capability: 3,
  regression: 5,
} as const;
