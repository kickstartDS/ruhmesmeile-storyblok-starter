#!/usr/bin/env tsx
/**
 * Throwaway: what would the deepseek grid cost?
 *
 *   npx tsx bin/estimate-grid.ts <in $/Mtok> <out $/Mtok> <cacheRead $/Mtok>
 *
 * Scales the spike's observed token profile by the ratio between one eval and
 * the full matrix, measured on the haiku-low cohort that already ran the same
 * 20 evals at the same 3 runs. Token counts move with the model, so this is an
 * order-of-magnitude figure, not a quote.
 *
 * Reads `efficiencyOf`, not `transcript.summary.tokens`. The latter counts one
 * API call once per transcript content block — 3.6× on the DeepSeek spike — so
 * an earlier revision of this script projected a grid 3.6× too expensive
 * (D-173).
 *
 * The spike's totals are divided by its trial count before scaling. That was a
 * no-op while the spike experiment held exactly one trial, and the code read
 * as if it were per-trial, so the omission was invisible until a second model
 * was spiked into the same experiment and the projection silently grew by the
 * number of spikes ever run. A quantity that is only correct while a count is
 * 1 should be written as a division by that count even when the division does
 * nothing, because the day it stops doing nothing is the day nobody is
 * looking.
 */

import { efficiencyOf } from "../lib/graders/efficiency";
import { loadEval, resolveMatrix } from "../lib/graders/trial";

const [inPrice, outPrice, cacheReadPrice] = process.argv
  .slice(2)
  .map((n) => Number(n));

type Totals = { input: number; output: number; cacheRead: number; n: number };
const zero = (): Totals => ({ input: 0, output: 0, cacheRead: 0, n: 0 });

function totals(experiment: string, only?: string): Totals {
  const acc = zero();
  for (const entry of resolveMatrix(experiment)) {
    if (only && entry.evalName !== only) continue;
    for (const trial of loadEval(experiment, entry.timestamp, entry.evalName)) {
      const efficiency = efficiencyOf(trial);
      if (!efficiency.available) continue;
      acc.input += efficiency.tokens.input;
      acc.output += efficiency.tokens.output;
      acc.cacheRead += efficiency.tokens.cacheRead;
      acc.n += 1;
    }
  }
  return acc;
}

const HAIKU_ARMS = [
  "cc-none-haiku-low",
  "cc-design-tokens-haiku-low",
  "cc-component-builder-haiku-low",
  "cc-both-haiku-low",
];

const cohort = zero();
for (const arm of HAIKU_ARMS) {
  const t = totals(arm);
  cohort.input += t.input;
  cohort.output += t.output;
  cohort.cacheRead += t.cacheRead;
  cohort.n += t.n;
}

const oneEval = totals("cc-both-haiku-low", "812-restyle-with-tokens");
const spike = totals("spike-novita-both");

const M = (n: number) => (n / 1_000_000).toFixed(1) + "M";
console.log(
  `haiku-low cohort (${cohort.n} trials): in ${M(cohort.input)} out ${M(cohort.output)} cacheR ${M(cohort.cacheRead)}`,
);
console.log(
  `  812-restyle on cc-both-haiku-low (${oneEval.n} trials): in ${M(oneEval.input)} out ${M(oneEval.output)} cacheR ${M(oneEval.cacheRead)}`,
);
console.log(
  `  spike on deepseek (${spike.n} trial): in ${M(spike.input)} out ${M(spike.output)} cacheR ${M(spike.cacheRead)}`,
);

// How much bigger is the whole cohort than the one eval we have a deepseek
// sample for? Per-trial, so the differing trial counts cancel.
const perTrial = (t: Totals) => ({
  input: t.input / t.n,
  output: t.output / t.n,
  cacheRead: t.cacheRead / t.n,
});
const h1 = perTrial(oneEval);
const hAll = perTrial(cohort);
const ratio = {
  input: hAll.input / h1.input,
  output: hAll.output / h1.output,
  cacheRead: hAll.cacheRead / h1.cacheRead,
};
console.log(
  `\nper-trial scale from 812-restyle to cohort average: ` +
    `in ${ratio.input.toFixed(2)}× out ${ratio.output.toFixed(2)}× cacheR ${ratio.cacheRead.toFixed(2)}×`,
);

const TRIALS = 240;
const spikeTrial = perTrial(spike);
const est = {
  input: spikeTrial.input * ratio.input * TRIALS,
  output: spikeTrial.output * ratio.output * TRIALS,
  cacheRead: spikeTrial.cacheRead * ratio.cacheRead * TRIALS,
};
console.log(
  `\nprojected deepseek grid (${TRIALS} trials): in ${M(est.input)} out ${M(est.output)} cacheR ${M(est.cacheRead)}`,
);

if ([inPrice, outPrice, cacheReadPrice].every((n) => Number.isFinite(n))) {
  const usd =
    (est.input / 1e6) * inPrice! +
    (est.output / 1e6) * outPrice! +
    (est.cacheRead / 1e6) * cacheReadPrice!;
  console.log(
    `  at $${inPrice}/$${outPrice}/$${cacheReadPrice} per Mtok → ~$${usd.toFixed(2)}`,
  );

  // Same token volume priced as Haiku, for the comparison that motivates this.
  const haikuUsd =
    (est.input / 1e6) * 1 +
    (est.output / 1e6) * 5 +
    (est.cacheRead / 1e6) * 0.1;
  console.log(
    `  the same volume at Haiku's $1/$5/$0.10 → ~$${haikuUsd.toFixed(2)}`,
  );
} else {
  console.log(
    `  pass prices to cost it:  npx tsx bin/estimate-grid.ts <in> <out> <cacheRead>`,
  );
}
