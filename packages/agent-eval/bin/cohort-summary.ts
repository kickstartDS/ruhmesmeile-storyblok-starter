#!/usr/bin/env tsx
/**
 * Per-arm aggregate for a cohort, plus what the same token volume would cost
 * on another model.
 *
 *   pnpm cohort <arm>... [--price <model>]
 *
 * The cost line exists because a model's pricing card does not tell you which
 * model is cheaper for this workload. The mix here is cache-dominated — the
 * DeepSeek spike read 2.15M cache tokens against 130K of input — so the cache
 * rate decides a bill that the headline input and output rates appear to.
 * Re-pricing a cohort that actually ran is the only estimate of a future
 * cohort worth quoting; `bin/estimate-grid.ts` extrapolates from a single
 * spike and is an order-of-magnitude figure by construction.
 *
 * Token volumes do move with the model, so this is still a projection: a model
 * that takes more turns to reach the same answer reads more cache. It bounds
 * the arithmetic, not the behaviour.
 */

import { efficiencyOf } from "../lib/graders/efficiency";
import { loadEval, resolveMatrix } from "../lib/graders/trial";
import { collectTrial } from "../lib/report/collect";
import { costOf } from "../lib/report/cost";
import { aggregate } from "../lib/report/metrics";

const argv = process.argv.slice(2);
const priceAt = argv.includes("--price")
  ? argv[argv.indexOf("--price") + 1]
  : undefined;
const arms = argv.filter(
  (arg, i) => !arg.startsWith("--") && argv[i - 1] !== "--price",
);

const cohort = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
let trials = 0;
let spent = 0;

for (const arm of arms) {
  const outcomes = [];
  for (const entry of resolveMatrix(arm)) {
    for (const trial of loadEval(arm, entry.timestamp, entry.evalName)) {
      outcomes.push(collectTrial(trial));
      const { tokens } = efficiencyOf(trial);
      cohort.input += tokens.input;
      cohort.output += tokens.output;
      cohort.cacheRead += tokens.cacheRead;
      cohort.cacheWrite += tokens.cacheWrite;
      trials += 1;
    }
  }
  const summary = aggregate(outcomes);
  if (!summary) {
    console.log(`${arm.padEnd(38)} no results`);
    continue;
  }
  spent += summary.spentUsd;
  console.log(
    `${arm.padEnd(38)} q=${summary.meanQuality.toFixed(3)} ` +
      `pass@1=${Math.round(summary.passAt1 * 100)}% ` +
      `n=${summary.counted} excl=${summary.excluded} ` +
      `$${summary.meanCostUsd.toFixed(3)}/trial ` +
      `mcp=${summary.meanMcpCalls.toFixed(1)}`,
  );
}

if (trials) {
  const M = (n: number) => (n / 1_000_000).toFixed(1) + "M";
  console.log(
    `\n${trials} trial(s): in ${M(cohort.input)} out ${M(cohort.output)} ` +
      `cacheR ${M(cohort.cacheRead)} cacheW ${M(cohort.cacheWrite)} — billed $${spent.toFixed(2)}`,
  );

  if (priceAt) {
    const { total } = costOf({ tokens: cohort }, priceAt);
    console.log(`the same volume on ${priceAt}: ~$${total.toFixed(2)}`);
  }
}
