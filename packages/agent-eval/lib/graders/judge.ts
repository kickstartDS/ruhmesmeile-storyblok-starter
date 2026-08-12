/**
 * 3.4 — the judge dimension of the composite score.
 *
 * This grader makes no network calls. It reads the verdicts `bin/judge.ts` left
 * in `judge.json` and turns them into checks. The separation is deliberate:
 * `npm run grade` is run constantly, often over the whole matrix, and a grader
 * that could spend money when someone re-grades would be a standing hazard —
 * ADR Decision 11 says spend is a human decision, and the only reliable way to
 * mean that is for the free path to have no code that can pay for anything.
 *
 * A trial that has never been judged reports `applicable: false`. That is not a
 * zero — `qualityScore` drops absent dimensions and renormalises the rest, so
 * un-judged trials keep the scores they already had, and the judge changes the
 * composite only where it has actually been run.
 *
 * Cached verdicts are filtered through `buildPrompt` rather than read straight
 * out of the file. A rubric that is retired, or narrowed so that it no longer
 * applies to a trial, leaves its old answers behind in `judge.json`, and those
 * answers are worth exactly as much as the reasoning that produced them — when
 * `api-design` was withdrawn for inventing the contents of a schema it had
 * never been shown, its verdicts stayed on disk and would have gone on scoring
 * trials that no longer ask the question (D-102). Deleting them is worse: the
 * file is the record of what was paid for.
 *
 * Verdicts from a rubric that has not passed calibration are reported but not
 * scored. Being asked is cheap and being believed is not: the judge only earns
 * its 15% one rubric at a time, as each clears the ≥80% agreement bar in
 * 3.6/3.7. See `Rubric.calibrated` (D-112).
 */

import { buildPrompt, readCache } from "../judge/run";
import { RUBRICS } from "../judge/rubrics";
import type { Trial } from "./trial";
import { partial, type GraderResult } from "./types";

export function judge(trial: Trial): GraderResult {
  const cache = readCache(trial.runDir);
  const labels = new Map(RUBRICS.map((rubric) => [rubric.id, rubric.label]));

  const live = new Set(
    RUBRICS.filter((rubric) => buildPrompt(trial, rubric)).map(
      (rubric) => rubric.id,
    ),
  );
  const results = Object.values(cache.results).filter((result) =>
    live.has(result.rubric),
  );

  const calibrated = new Set(
    RUBRICS.filter((rubric) => rubric.calibrated).map((rubric) => rubric.id),
  );

  // `unknown` is excluded rather than scored, so a rubric the judge could not
  // answer neither rewards nor punishes the trial. A dimension where every
  // rubric came back unknown is not a zero — it is no measurement at all. An
  // uncalibrated rubric is excluded for the same reason: an answer nobody has
  // checked is not a measurement either.
  const answered = results.filter(
    (result) => result.verdict !== "unknown" && calibrated.has(result.rubric),
  );

  const checks = results.map((result) => {
    const note = !calibrated.has(result.rubric)
      ? `uncalibrated, not scored — ${result.reason}`
      : result.verdict === "unknown"
        ? `unknown — ${result.reason}`
        : result.reason;

    return partial(
      result.rubric,
      labels.get(result.rubric) ?? result.rubric,
      result.verdict === "unknown" ? 0 : result.score,
      note,
    );
  });

  const score = answered.length
    ? answered.reduce((sum, result) => sum + result.score, 0) / answered.length
    : 0;

  return {
    id: "judge",
    dimension: "judge",
    applicable: answered.length > 0,
    score,
    passed: score >= 0.8,
    checks,
  };
}
