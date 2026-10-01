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
 * The judge model *tier* (Decision 8).
 *
 * Superseded as a pin by `JUDGE_MODEL_ID` in `lib/judge/run.ts`. A `ModelTier`
 * is not a pin: "opus" resolves to whatever is current when it is called, so
 * two scores taken months apart could come from different models with nothing
 * on record to say so — the drift a pinned judge exists to rule out (D-96,
 * ADR 72). The judge names a dated release instead, and verifies it against the
 * API before spending.
 *
 * Kept because the harness's own judge matchers take a tier, should an eval ever
 * call one. Nothing reads it today.
 */
export const JUDGE_MODEL: ModelTier = "opus";

export const DEFAULTS = {
  /**
   * 30 minutes. Raised from 15 to 20 after the first baseline run (the slowest
   * no-MCP trial took 653s against a 900s ceiling), then to 30 when the first
   * Haiku trial was killed at the 1200s mark.
   *
   * Both ceilings were sized against Sonnet, and a cheaper model is the wrong
   * thing to size against a Sonnet observation: it does not do less work, it
   * takes more turns to do the same work, so the wall clock moves in the
   * opposite direction to the price. MCP variants compound that — the token
   * MCP alone can be a dozen roundtrips per decision.
   *
   * A timeout kill wastes the entire spend of a trial and returns nothing to
   * grade, which is the most expensive possible outcome. The ceiling is
   * therefore deliberately far above the observed mean rather than close to
   * it; it exists to stop a wedged trial, not to bound a slow one.
   *
   * `timeout` is part of the framework fingerprint, so this invalidates cached
   * results everywhere. That is free for the Haiku arms, which have none, and
   * academic for the Sonnet arms, whose campaign is complete and whose results
   * are read off disk by `grade`/`report`/`cost` regardless.
   */
  timeout: 1800,

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

/**
 * Runs per task, by suite (D9).
 *
 * `EVAL_RUNS` exists for power, not for convenience: at three runs a binary
 * check has ±1-trial resolution, which is why a +2/60 gate difference and a
 * +0.002 quality difference cannot be read at all. Spend the extra runs on the
 * tasks with headroom rather than on the suite — `RUNS=6 bash bin/run-split.sh
 * --arms …` propagates this to the experiment, so the count the batch verifier
 * checks and the count the experiment records cannot diverge.
 *
 * `runs` is part of the framework's fingerprint, so changing it invalidates
 * results rather than mixing 3-run and 6-run trials in one arm.
 */
export const RUNS = {
  capability: capabilityRuns(),
  regression: 5,
};

function capabilityRuns(): number {
  const raw = process.env.EVAL_RUNS;
  if (!raw) return 3;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      `EVAL_RUNS must be a positive integer, got ${JSON.stringify(raw)}`,
    );
  }
  return parsed;
}
