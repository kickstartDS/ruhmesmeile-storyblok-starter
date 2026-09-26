#!/usr/bin/env tsx
/**
 * Throwaway: per-trial cache share against trial duration.
 *
 * Asks whether the cohort-level cache share is a single population or a
 * mixture. Anthropic's ephemeral cache has a 5-minute TTL, and GLM's median
 * trial is 632s, so a turn that takes longer than the TTL re-pays the whole
 * prompt as fresh input. If that is what is happening, cache share should fall
 * as trials get slower rather than scattering.
 */

import { efficiencyOf } from "../lib/graders/efficiency";
import { listRuns, loadRun } from "../lib/graders/trial";

const arms = process.argv.slice(2);
const buckets = new Map<string, { n: number; input: number; cache: number }>();
const rows: { share: number; duration: number; turns: number }[] = [];

for (const arm of arms) {
  for (const run of listRuns(arm)) {
    for (const trial of loadRun(arm, run)) {
      const eff = efficiencyOf(trial);
      if (!eff.available) continue;
      const prompt = eff.tokens.input + eff.tokens.cacheRead;
      if (!prompt) continue;
      const share = eff.tokens.cacheRead / prompt;
      const duration = trial.duration ?? 0;
      rows.push({ share, duration, turns: eff.turns });

      const key =
        duration < 300
          ? "  <5min"
          : duration < 600
            ? " 5-10min"
            : duration < 1200
              ? "10-20min"
              : duration < 2400
                ? "20-40min"
                : "  >40min";
      const b = buckets.get(key) ?? { n: 0, input: 0, cache: 0 };
      b.n += 1;
      b.input += eff.tokens.input;
      b.cache += eff.tokens.cacheRead;
      buckets.set(key, b);
    }
  }
}

rows.sort((a, b) => a.share - b.share);
const pct = (v: number) => (v * 100).toFixed(1) + "%";
console.log(`${rows.length} trials with usage`);
console.log(
  `cache share  min ${pct(rows[0].share)}  p25 ${pct(rows[Math.floor(rows.length * 0.25)].share)}` +
    `  median ${pct(rows[Math.floor(rows.length * 0.5)].share)}` +
    `  p75 ${pct(rows[Math.floor(rows.length * 0.75)].share)}  max ${pct(rows[rows.length - 1].share)}`,
);
console.log("\nby duration bucket (pooled tokens, not mean of shares):");
for (const key of [...buckets.keys()].sort()) {
  const b = buckets.get(key)!;
  console.log(
    `  ${key}  n=${String(b.n).padStart(3)}  cache share ${pct(b.cache / (b.cache + b.input)).padStart(6)}` +
      `  net in/trial ${(b.input / b.n / 1000).toFixed(0)}K`,
  );
}
