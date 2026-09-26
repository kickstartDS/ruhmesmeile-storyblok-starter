/**
 * Both MCP servers. DeepSeek v4.1 Flash via Novita, no effort flag.
 *
 * The upper bound of the `deepseek-default` cohort, and the only arm with a
 * DeepSeek measurement already on record: the D-170 spike ran this variant on
 * `812-restyle-with-tokens` and scored 0.961 with 26 MCP calls across 14 tools.
 * One trial on one eval proves the plumbing, not the effect.
 *
 * The standing result this tests is the campaign's most robust negative: on
 * Sonnet, `haiku-high` and `haiku-low`, adding design-tokens on top of
 * component-builder has never bought anything. It tied at high effort (+0.094
 * against +0.093) and trailed at low (+0.070 against +0.079). Three cohorts of
 * tie-or-trail is a pattern; a fourth, on a different vendor's model, would
 * make it hard to explain as anything but interference between two servers
 * competing for the same context budget.
 *
 * Pre-registration: ties or trails `cc-component-builder-deepseek-default`.
 * The interference hypothesis predicts trailing, and predicts it more clearly
 * here than in any previous cohort — the spike's uncached input was larger on a
 * single trial than the entire 240-trial `haiku-low` cohort's, which means this
 * model is either caching far less or carrying far more context per turn. If
 * context budget is what the two servers contend for, this is the cohort where
 * the contention should be most visible.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { DEEPSEEK_MODEL, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-both-deepseek-default",
  variant: "both",
  runs: RUNS.capability,
  ...novita(DEEPSEEK_MODEL),
});
