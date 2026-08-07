/**
 * Assembling one comparable matrix out of several runs.
 *
 * Running the matrix in chunks is the only affordable way to work: a full
 * 5-eval × 4-arm × 3-run sweep is ~$310, and the framework already supports it
 * by skipping evals whose fingerprint still matches. What it does not do is
 * tell you whether the pile of results you have accumulated still constitutes a
 * matrix you are allowed to compare.
 *
 * That is the risk iterative running introduces. Editing an eval between chunks
 * is cheap, silent, and leaves every arm still reporting a number — the arms
 * simply stop measuring the same task. `contentFingerprint` (eval files only,
 * no config) is exactly the value that has to agree across arms, so we check it
 * instead of trusting the campaign to have been disciplined.
 */

import { collectTrial, type Outcome } from "./collect";
import { loadMatrix, resolveMatrix, type MatrixEntry } from "../graders/trial";

export interface MatrixCell {
  evalName: string;
  experiment: string;
  entry: MatrixEntry | null;
}

export interface MatrixIntegrity {
  evals: string[];
  experiments: string[];
  /** Arm/eval pairs with no results yet — the remaining spend. */
  missing: MatrixCell[];
  /** Evals whose definition differs between arms. These cannot be compared. */
  divergent: Array<{
    evalName: string;
    fingerprints: Array<{ experiment: string; contentFingerprint: string }>;
  }>;
  complete: boolean;
  comparable: boolean;
}

/** The current result set for an experiment, graded. */
export function collectMatrix(experiment: string): Outcome[] {
  return loadMatrix(experiment).map(collectTrial);
}

/**
 * Check that the accumulated results form a matrix worth comparing.
 *
 * `complete` means every arm has run every eval. `comparable` is the stricter
 * and more important one: every arm that ran a given eval ran the *same* eval.
 * A matrix can be comparable while incomplete — that is the normal mid-campaign
 * state, and it is fine to report on, as long as the gaps are visible.
 */
export function matrixIntegrity(experiments: string[]): MatrixIntegrity {
  const resolved = new Map<string, MatrixEntry[]>(
    experiments.map((experiment) => [experiment, resolveMatrix(experiment)]),
  );

  const evals = [
    ...new Set([...resolved.values()].flatMap((e) => e.map((x) => x.evalName))),
  ].sort();

  const missing: MatrixCell[] = [];
  const divergent: MatrixIntegrity["divergent"] = [];

  for (const evalName of evals) {
    const present: Array<{ experiment: string; contentFingerprint: string }> =
      [];

    for (const experiment of experiments) {
      const entry = resolved
        .get(experiment)
        ?.find((candidate) => candidate.evalName === evalName);

      if (!entry) {
        missing.push({ evalName, experiment, entry: null });
        continue;
      }
      // An older result predating fingerprint recording. Not provably the same
      // task, so it is reported rather than quietly assumed to match.
      if (entry.contentFingerprint) {
        present.push({
          experiment,
          contentFingerprint: entry.contentFingerprint,
        });
      }
    }

    const distinct = new Set(present.map((p) => p.contentFingerprint));
    if (distinct.size > 1) divergent.push({ evalName, fingerprints: present });
  }

  return {
    evals,
    experiments,
    missing,
    divergent,
    complete: missing.length === 0,
    comparable: divergent.length === 0,
  };
}
