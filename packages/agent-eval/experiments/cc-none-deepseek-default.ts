/**
 * Baseline: no MCP servers. DeepSeek v4.1 Flash via Novita, no effort flag.
 *
 * The floor of the `deepseek-default` cohort, and the term every other
 * `-deepseek-default` arm is measured against. Same 20 evals and same 3 runs as
 * the `haiku-low` cohort, so the two cohorts' *deltas* are comparable even
 * though their absolute scores are not.
 *
 * Why this cohort exists. Every finding the campaign has is from one vendor's
 * models. "Component-builder helps, design-tokens does not" could be a fact
 * about MCP servers, or a fact about how Claude models in particular respond to
 * them — nothing run so far can tell those apart. A second model family from a
 * different vendor is the cheapest available test of which it is, and a
 * reproduction there would be the most transferable result in the campaign.
 *
 * No effort flag. The harness turns `effort` into a CLI argument, and there is
 * no evidence this endpoint honours it; `flash` also suggests a model with
 * little deliberation to modulate. Passing it would add an axis whose value is
 * unknown rather than controlled, so the cohort is named `default` for the
 * absence and effort is simply not an axis here. `haiku-low` is the reference
 * cohort, being the cheaper of the two Haiku cohorts and — per D-169 — the
 * better-scoring one.
 *
 * Pre-registration: absolute quality lands below `cc-none-haiku-low`'s 0.854.
 * The spike scored 0.961 on `812-restyle-with-tokens`, but that was the `both`
 * variant on the single eval chosen for being the cheapest, which is a weak
 * basis for expecting anything. What matters is not where this lands but that
 * whatever it is becomes the floor for this cohort's deltas.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { DEEPSEEK_MODEL, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-none-deepseek-default",
  variant: "none",
  runs: RUNS.capability,
  ...novita(DEEPSEEK_MODEL),
});
