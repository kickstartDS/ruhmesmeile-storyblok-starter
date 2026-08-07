/**
 * Grader vocabulary.
 *
 * A grader turns one trial into a scored result. Every grader returns partial
 * credit rather than a bare boolean: a variant that misses one lint rule and a
 * variant that produced unusable output must not look identical in the report
 * (PRD §7.4).
 *
 * Graders run on the HOST, over the captured `project/` snapshot — not in the
 * sandbox. See ADR Decision 17: anything uploaded into the sandbox before the
 * agent runs is readable by the agent, and a readable rubric is a leaked rubric.
 */

/** Weighting groups of the composite quality score (PRD §7.4). */
export type Dimension = "contract" | "toolchain" | "runtime" | "judge";

export interface Check {
  id: string;
  label: string;
  passed: boolean;
  /** 0..1. Whole numbers for binary checks, fractions where partial credit is meaningful. */
  score: number;
  /** Why it scored what it scored. Shown verbatim in the report. */
  details?: string;
}

export interface GraderResult {
  id: string;
  dimension: Dimension;
  /**
   * False when the grader had nothing to judge — e.g. token conformance with no
   * stylesheet in the project. Inapplicable graders are excluded from the mean
   * instead of scoring zero, so a missing file is punished once (by the
   * contract grader) rather than cascading through every other grader.
   */
  applicable: boolean;
  score: number;
  passed: boolean;
  checks: Check[];
}

export function check(
  id: string,
  label: string,
  passed: boolean,
  details?: string,
): Check {
  return { id, label, passed, score: passed ? 1 : 0, details };
}

export function partial(
  id: string,
  label: string,
  score: number,
  details?: string,
): Check {
  const clamped = Math.max(0, Math.min(1, score));
  return { id, label, passed: clamped === 1, score: clamped, details };
}

export function result(
  id: string,
  dimension: Dimension,
  checks: Check[],
  applicable = true,
): GraderResult {
  const score = checks.length
    ? checks.reduce((sum, c) => sum + c.score, 0) / checks.length
    : 0;
  return {
    id,
    dimension,
    applicable,
    score,
    passed: applicable && checks.every((c) => c.passed),
    checks,
  };
}

export function notApplicable(
  id: string,
  dimension: Dimension,
  reason: string,
): GraderResult {
  return {
    id,
    dimension,
    applicable: false,
    score: 0,
    passed: false,
    checks: [check("not-applicable", reason, false, reason)],
  };
}
