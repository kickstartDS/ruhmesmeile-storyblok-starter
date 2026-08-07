/**
 * `pnpm grade` — grade captured runs, host-side.
 *
 * Grading never runs the agent, so it costs nothing and can be re-run over
 * historical results whenever a grader changes. That is deliberate: the P0
 * rubric turned out to encode a file contract the design system does not use,
 * and re-grading the existing trials cost nothing instead of three paid runs.
 *
 *   pnpm grade                          # latest run of every experiment
 *   pnpm grade cc-none-sonnet-high      # latest run of one experiment
 *   pnpm grade cc-none-sonnet-high 2026-08-06T19-02-52.634Z
 *   pnpm grade --json                   # machine-readable, for CI
 *   pnpm grade --baseline cc-none-sonnet-high
 */

import { writeFileSync } from "node:fs";
import { collectRun, latestRun, type Outcome } from "../lib/report/collect";
import { collectMatrix, matrixIntegrity } from "../lib/report/matrix";
import { aggregate, delta, type Aggregate } from "../lib/report/metrics";
import { formatUsd } from "../lib/report/cost";
import { listExperiments } from "../lib/graders/trial";
import { WEIGHTS_VERSION } from "../lib/graders/quality";

const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? (argv[index + 1] ?? null) : null;
};
const has = (name: string): boolean => argv.includes(`--${name}`);
const positional = argv.filter(
  (arg, index) =>
    !arg.startsWith("--") &&
    !(index > 0 && argv[index - 1] === "--baseline") &&
    !(index > 0 && argv[index - 1] === "--out"),
);

const baselineExperiment = flag("baseline") ?? "cc-none-sonnet-high";
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const num = (value: number, digits = 1): string => value.toFixed(digits);
const times = (value: number): string =>
  Number.isFinite(value) ? `${value.toFixed(2)}×` : "n/a";

/**
 * What to grade.
 *
 * By default this is the *resolved* result set per experiment — the newest
 * result for each eval, wherever it lives. Reading a single timestamp only
 * works when the whole matrix was bought in one go, which it generally is not.
 *
 * Passing an explicit timestamp still pins one historical run, which is what
 * you want when re-examining a specific campaign.
 */
function targets(): Array<{ experiment: string; timestamp: string | null }> {
  const [experiment, timestamp] = positional;

  if (experiment && timestamp) return [{ experiment, timestamp }];
  if (experiment) return [{ experiment, timestamp: null }];

  return listExperiments().map((name) => ({ experiment: name, timestamp: null }));
}

function printOutcome(outcome: Outcome): void {
  const verdict = outcome.harnessPassed ? "PASS" : "FAIL";
  const note =
    outcome.failureClass === "model" || outcome.failureClass === "none"
      ? ""
      : `  [excluded — ${outcome.failureClass}: ${outcome.failureReason}]`;

  console.log(
    `  run-${outcome.run}  ${verdict}  quality ${num(outcome.quality.score, 2)}  ` +
      `${num(outcome.durationSeconds)}s  ${outcome.efficiency.turns} turns${note}`,
  );

  for (const grader of outcome.graders) {
    if (!grader.applicable) {
      console.log(`      ·  ${grader.id.padEnd(20)} n/a`);
      continue;
    }
    const mark = grader.passed ? "✓" : "✗";
    console.log(
      `      ${mark}  ${grader.id.padEnd(20)} ${num(grader.score, 2)}`,
    );
    for (const item of grader.checks.filter((c) => !c.passed)) {
      console.log(
        `           └─ ${item.label}${item.details ? ` — ${item.details}` : ""}`,
      );
    }
  }

  for (const diagnostic of outcome.diagnostics.filter((d) => d.applicable)) {
    for (const item of diagnostic.checks) {
      console.log(
        `      ${item.passed ? "·" : "!"}  ${diagnostic.id}/${item.id}` +
          `${item.details ? ` — ${item.details}` : ""}`,
      );
    }
  }
}

function printAggregate(entry: Aggregate): void {
  console.log(
    `\n  ── ${entry.evalName} — ${entry.counted} counted, ${entry.excluded} excluded` +
      `${entry.invalid ? "  ** RUN INVALID: >20% non-model failures **" : ""}`,
  );
  for (const [reason, count] of Object.entries(entry.excludedReasons)) {
    console.log(`     excluded ×${count}: ${reason}`);
  }
  console.log(
    `     pass@1 ${pct(entry.passAt1)}   pass^k ${entry.passHatK ? "yes" : "no"}   ` +
      `quality ${num(entry.meanQuality, 2)} ±${num(entry.qualityStdDev, 2)}   ` +
      `${num(entry.meanDurationSeconds)}s   ` +
      `${num(entry.meanTurns)} turns   ${Math.round(entry.meanOutputTokens)} out-tok` +
      (entry.meanMcpCalls > 0
        ? `   ${num(entry.meanMcpCalls)} mcp calls / ~${Math.round(entry.meanMcpResultTokens)} mcp-tok`
        : ""),
  );
  console.log(
    `     ${formatUsd(entry.meanCostUsd)}/trial   ${formatUsd(entry.spentUsd)} spent` +
      (entry.excluded > 0 ? " (incl. excluded trials)" : ""),
  );
}

const collected = targets().map(({ experiment, timestamp }) => {
  const outcomes = timestamp
    ? collectRun(experiment, timestamp)
    : collectMatrix(experiment);
  const byEval = new Map<string, Outcome[]>();
  for (const outcome of outcomes) {
    const list = byEval.get(outcome.evalName) ?? [];
    list.push(outcome);
    byEval.set(outcome.evalName, list);
  }
  return {
    experiment,
    timestamp: timestamp ?? "resolved",
    outcomes,
    aggregates: [...byEval.values()]
      .map(aggregate)
      .filter((entry): entry is Aggregate => entry !== null),
  };
});

const integrity = matrixIntegrity(collected.map((entry) => entry.experiment));

/**
 * State the shape of the evidence before reporting numbers on it.
 *
 * An incomplete matrix is a normal mid-campaign state and is fine to read. A
 * divergent one is not: the arms ran different versions of the same eval, so
 * the deltas below are between two different questions.
 */
function printIntegrity(): void {
  const cells = integrity.evals.length * integrity.experiments.length;
  const have = cells - integrity.missing.length;
  console.log(
    `Matrix — ${have}/${cells} cells ` +
      `(${integrity.evals.length} evals × ${integrity.experiments.length} arms).`,
  );

  if (!integrity.comparable) {
    console.log(
      "\n  NOT COMPARABLE — an eval changed between arms. Deltas below are\n" +
        "  measuring different tasks against each other. Re-run the affected\n" +
        "  arms before drawing conclusions:",
    );
    for (const entry of integrity.divergent) {
      console.log(`    ${entry.evalName}`);
      for (const fp of entry.fingerprints) {
        console.log(
          `      ${fp.contentFingerprint.slice(0, 12)}  ${fp.experiment}`,
        );
      }
    }
  }

  if (integrity.missing.length > 0) {
    const byEval = new Map<string, string[]>();
    for (const cell of integrity.missing) {
      byEval.set(cell.evalName, [
        ...(byEval.get(cell.evalName) ?? []),
        cell.experiment,
      ]);
    }
    console.log("\n  Not yet run:");
    for (const [evalName, experiments] of byEval) {
      console.log(`    ${evalName.padEnd(26)} ${experiments.join(", ")}`);
    }
  }
}

if (has("json")) {
  const payload = JSON.stringify(
    { weightsVersion: WEIGHTS_VERSION, integrity, runs: collected },
    null,
    2,
  );
  const out = flag("out");
  if (out) writeFileSync(out, payload);
  else console.log(payload);
} else {
  console.log(`\nGrading (weights v${WEIGHTS_VERSION}) — host-side, no spend.`);

  printIntegrity();

  for (const run of collected) {
    console.log(`\n${run.experiment}  ${run.timestamp}`);
    for (const outcome of run.outcomes) printOutcome(outcome);
    for (const entry of run.aggregates) printAggregate(entry);
  }

  const baselineRun = collected.find(
    (r) => r.experiment === baselineExperiment,
  );
  const others = collected.filter((r) => r.experiment !== baselineExperiment);

  if (baselineRun && others.length > 0) {
    console.log(`\nDeltas against ${baselineExperiment}:`);
    for (const run of others) {
      for (const candidate of run.aggregates) {
        const base = baselineRun.aggregates.find(
          (entry) => entry.evalName === candidate.evalName,
        );
        if (!base) continue;
        const d = delta(candidate, base);
        console.log(
          `\n  ${candidate.evalName} — ${run.experiment}\n` +
            `     quality ${d.quality >= 0 ? "+" : ""}${num(d.quality, 2)}   ` +
            `pass@1 ${d.passAt1 >= 0 ? "+" : ""}${pct(d.passAt1)}   ` +
            `time ${times(d.durationRatio)}   turns ${times(d.turnsRatio)}   ` +
            `out-tokens ${times(d.outputTokenRatio)}   cost ${times(d.costRatio)}` +
            (Number.isFinite(d.qualityPerExtraDollar)
              ? `   ${num(d.qualityPerExtraDollar, 3)} quality/extra-$`
              : ""),
        );
        const moved = Object.entries(d.graderDeltas)
          .filter(([, value]) => Math.abs(value) > 0.01)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
        for (const [id, value] of moved) {
          console.log(
            `        ${id.padEnd(20)} ${value >= 0 ? "+" : ""}${num(value, 2)}`,
          );
        }
      }
    }
  } else if (!baselineRun) {
    console.log(
      `\n(no baseline run for "${baselineExperiment}" — deltas skipped)`,
    );
  }

  const invalid = collected.flatMap((r) =>
    r.aggregates.filter((entry) => entry.invalid),
  );
  if (invalid.length > 0) {
    console.log(
      `\n${invalid.length} run(s) marked invalid — do not update baselines from these.`,
    );
    process.exitCode = 1;
  }
}
