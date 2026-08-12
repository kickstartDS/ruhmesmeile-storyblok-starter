/**
 * Addressing a trial from the command line.
 *
 * `<experiment>/<eval>[/run-N]`, with the timestamp segment optional because
 * nobody types one from memory: the current timestamp for an eval is looked up
 * through `resolveMatrix`, but a pasted path that still carries one is
 * tolerated. Shared by `bin/report.ts` and `bin/judge.ts`.
 */

import { loadEval, resolveMatrix, type Trial } from "./graders/trial";

export interface Address {
  experiment: string;
  evalName: string;
  run: number | null;
}

export function parseAddress(raw: string): Address {
  const parts = raw.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Cannot parse "${raw}". Expected <experiment>/<eval>[/run-N].`,
    );
  }

  const runPart = parts.at(-1)!;
  const runMatch = /^run-(\d+)$/.exec(runPart);

  return {
    experiment: parts[0],
    evalName: runMatch ? parts.at(-2)! : parts.at(-1)!,
    run: runMatch ? Number(runMatch[1]) : null,
  };
}

export function resolveTrials(address: Address): Trial[] {
  const entry = resolveMatrix(address.experiment).find(
    (candidate) => candidate.evalName === address.evalName,
  );

  if (!entry) {
    throw new Error(
      `No current result for ${address.experiment}/${address.evalName}.`,
    );
  }

  const trials = loadEval(address.experiment, entry.timestamp, entry.evalName);
  if (address.run === null) return trials;

  const one = trials.find((trial) => trial.run === address.run);
  if (!one) {
    throw new Error(
      `${address.experiment}/${address.evalName} has no run-${address.run}.`,
    );
  }
  return [one];
}
