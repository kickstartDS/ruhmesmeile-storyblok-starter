/**
 * 1.15 — aggregation and baseline deltas.
 *
 * The headline of this package is not "variant X scored 0.62". It is "variant X
 * scored 0.62 against a 0.41 baseline, at 1.7× the wall clock and 3.2× the
 * context". Everything here exists to make that sentence printable.
 *
 * Validity rules, applied here rather than in the report so they cannot be
 * skipped by a caller:
 *   - `infra` and `timeout` trials are excluded from pass rates and scores.
 *   - A run with >20% non-model trials is marked invalid and must not update a
 *     baseline (PRD §7.5).
 */

import type { Outcome } from "./collect";

export interface Aggregate {
  experiment: string;
  variant: string;
  timestamp: string;
  evalName: string;
  /** Trials that count — model failures and passes. */
  counted: number;
  excluded: number;
  excludedReasons: Record<string, number>;
  /** True when too much of the run was non-model failure to trust it. */
  invalid: boolean;
  passAt1: number;
  /** All counted trials passed — the consistency bar a gate cares about. */
  passHatK: boolean;
  meanQuality: number;
  /**
   * Spread of quality across counted trials. Item 1.19 asks how many runs a
   * task needs; that is answerable only against the run-to-run variance, so it
   * is reported rather than left for someone to recompute by hand.
   */
  qualityStdDev: number;
  meanDurationSeconds: number;
  meanTurns: number;
  meanOutputTokens: number;
  /** Mean estimated USD per counted trial. */
  meanCostUsd: number;
  /**
   * Estimated USD for every trial in the run, excluded ones included. You pay
   * for a confounded trial exactly like any other, so budgeting from the
   * counted-only mean understates a run that had to throw work away.
   */
  spentUsd: number;
  meanMcpCalls: number;
  meanMcpResultTokens: number;
  meanRework: number;
  /** Per-grader mean score, for spotting which rule moved. */
  graderScores: Record<string, number>;
}

const mean = (values: number[]): number =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
};

export function aggregate(outcomes: Outcome[]): Aggregate | null {
  if (outcomes.length === 0) return null;

  const first = outcomes[0]!;
  const counted = outcomes.filter(
    (o) => o.failureClass === "model" || o.failureClass === "none",
  );
  const excluded = outcomes.filter((o) => !counted.includes(o));

  const excludedReasons: Record<string, number> = {};
  for (const outcome of excluded) {
    const key = `${outcome.failureClass}: ${outcome.failureReason ?? "unknown"}`;
    excludedReasons[key] = (excludedReasons[key] ?? 0) + 1;
  }

  const graderScores: Record<string, number> = {};
  const graderIds = new Set(
    counted.flatMap((o) =>
      o.graders.filter((g) => g.applicable).map((g) => g.id),
    ),
  );
  for (const id of graderIds) {
    graderScores[id] = mean(
      counted
        .map((o) => o.graders.find((g) => g.id === id))
        .filter((g): g is NonNullable<typeof g> => Boolean(g?.applicable))
        .map((g) => g.score),
    );
  }

  return {
    experiment: first.experiment,
    variant: first.variant,
    timestamp: first.timestamp,
    evalName: first.evalName,
    counted: counted.length,
    excluded: excluded.length,
    excludedReasons,
    invalid: outcomes.length > 0 && excluded.length / outcomes.length > 0.2,
    passAt1: counted.length
      ? counted.filter((o) => o.harnessPassed).length / counted.length
      : 0,
    passHatK: counted.length > 0 && counted.every((o) => o.harnessPassed),
    meanQuality: mean(counted.map((o) => o.quality.score)),
    qualityStdDev: stdDev(counted.map((o) => o.quality.score)),
    meanDurationSeconds: mean(counted.map((o) => o.durationSeconds)),
    meanTurns: mean(counted.map((o) => o.efficiency.turns)),
    meanOutputTokens: mean(counted.map((o) => o.efficiency.tokens.output)),
    meanCostUsd: mean(counted.map((o) => o.cost.total)),
    spentUsd: outcomes.reduce((sum, o) => sum + o.cost.total, 0),
    // A delegated trial genuinely used MCP but reports zero calls, because the
    // subagent's turns never reach the transcript. Averaging that zero in would
    // understate the arm's MCP cost, so those trials sit out these two means
    // while still counting everywhere else.
    meanMcpCalls: mean(
      counted.filter((o) => !o.mcp.delegated).map((o) => o.mcp.totalCalls),
    ),
    meanMcpResultTokens: mean(
      counted
        .filter((o) => !o.mcp.delegated)
        .map((o) => o.efficiency.mcpResultTokens),
    ),
    meanRework: mean(counted.map((o) => o.efficiency.rework)),
    graderScores,
  };
}

export interface Delta {
  variant: string;
  quality: number;
  passAt1: number;
  durationRatio: number;
  turnsRatio: number;
  outputTokenRatio: number;
  costRatio: number;
  /**
   * Quality points bought per extra dollar, versus the baseline. Negative or
   * infinite where the arm costs no more; the point is to rank arms that all
   * improve quality by what the improvement costs.
   */
  qualityPerExtraDollar: number;
  mcpResultTokens: number;
  /** Per-grader change, so a report can name the rule that moved. */
  graderDeltas: Record<string, number>;
}

const ratio = (value: number, base: number): number =>
  base === 0 ? (value === 0 ? 1 : Infinity) : value / base;

export function delta(candidate: Aggregate, baseline: Aggregate): Delta {
  const graderDeltas: Record<string, number> = {};
  for (const [id, score] of Object.entries(candidate.graderScores)) {
    if (id in baseline.graderScores) {
      graderDeltas[id] = score - baseline.graderScores[id]!;
    }
  }

  return {
    variant: candidate.variant,
    quality: candidate.meanQuality - baseline.meanQuality,
    passAt1: candidate.passAt1 - baseline.passAt1,
    durationRatio: ratio(
      candidate.meanDurationSeconds,
      baseline.meanDurationSeconds,
    ),
    turnsRatio: ratio(candidate.meanTurns, baseline.meanTurns),
    outputTokenRatio: ratio(
      candidate.meanOutputTokens,
      baseline.meanOutputTokens,
    ),
    costRatio: ratio(candidate.meanCostUsd, baseline.meanCostUsd),
    qualityPerExtraDollar:
      candidate.meanCostUsd > baseline.meanCostUsd
        ? (candidate.meanQuality - baseline.meanQuality) /
          (candidate.meanCostUsd - baseline.meanCostUsd)
        : Infinity,
    mcpResultTokens: candidate.meanMcpResultTokens,
    graderDeltas,
  };
}
