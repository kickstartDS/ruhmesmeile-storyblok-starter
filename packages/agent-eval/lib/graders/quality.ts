/**
 * 1.13 — the composite quality score.
 *
 * Weights are versioned. A score is only ever comparable within one weighting
 * version, so `WEIGHTS_VERSION` is printed in every report and stored on every
 * outcome record; changing a weight without bumping it would silently rewrite
 * history.
 *
 * Weights differ from the PRD's draft because two of the four dimensions do not
 * exist yet: toolchain graders (1.8) need a fixture that installs the design
 * system, and the judge (P3) is not wired. Rather than score those as zero —
 * which would make every variant look equally bad and compress the deltas we
 * are trying to measure — absent dimensions are dropped and the remaining
 * weights renormalised. `dimensions` in the output records what was actually
 * counted.
 */

import type { Dimension, GraderResult } from "./types";

export const WEIGHTS_VERSION = "1";

export const WEIGHTS: Record<Dimension, number> = {
  contract: 0.4,
  toolchain: 0.25,
  runtime: 0.2,
  judge: 0.15,
};

export interface QualityScore {
  weightsVersion: string;
  score: number;
  /** Per-dimension mean over applicable graders, and the weight it received. */
  dimensions: Record<
    string,
    { score: number; weight: number; graders: string[] }
  >;
  /** Dimensions with no applicable grader, whose weight was redistributed. */
  missing: Dimension[];
}

export function qualityScore(results: GraderResult[]): QualityScore {
  const applicable = results.filter((r) => r.applicable);
  const dimensions: QualityScore["dimensions"] = {};
  const missing: Dimension[] = [];

  let totalWeight = 0;
  for (const dimension of Object.keys(WEIGHTS) as Dimension[]) {
    const inDimension = applicable.filter((r) => r.dimension === dimension);
    if (inDimension.length === 0) {
      missing.push(dimension);
      continue;
    }
    const score =
      inDimension.reduce((sum, r) => sum + r.score, 0) / inDimension.length;
    dimensions[dimension] = {
      score,
      weight: WEIGHTS[dimension],
      graders: inDimension.map((r) => r.id),
    };
    totalWeight += WEIGHTS[dimension];
  }

  const score =
    totalWeight === 0
      ? 0
      : Object.values(dimensions).reduce(
          (sum, d) => sum + d.score * (d.weight / totalWeight),
          0,
        );

  // Renormalised weights are what actually applied — report those, not the
  // nominal ones, or the printed weights will not explain the printed score.
  for (const entry of Object.values(dimensions)) {
    entry.weight = totalWeight === 0 ? 0 : entry.weight / totalWeight;
  }

  return { weightsVersion: WEIGHTS_VERSION, score, dimensions, missing };
}
