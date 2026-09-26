/**
 * component-builder MCP only. DeepSeek v4.1 Flash via Novita, no effort flag.
 *
 * The strongest arm of both Haiku cohorts, and on Sonnet before them. Its
 * delta against `cc-none-deepseek-default` is the clearest single test this
 * cohort runs: component-builder is the server the campaign has the most
 * evidence for, and if its effect is real rather than an artefact of Claude
 * models it should survive a change of vendor.
 *
 * The measured deltas so far, all against their own cohort's baseline:
 * +0.23 on Sonnet, +0.093 on `haiku-high`, +0.079 on `haiku-low`. The decline
 * is monotonic and unexplained — it tracks model capability, which would fit
 * the obvious story that a weaker model has more to gain, except that it runs
 * the wrong way for that story.
 *
 * Pre-registration: positive, and larger than design-tokens' delta in the same
 * cohort. Deliberately not a number — the three existing measurements span
 * 0.079 to 0.23 and no model of that spread has earned the right to predict a
 * fourth. A *negative or zero* delta here is the outcome that would matter
 * most: it would confine three campaigns' worth of the campaign's headline
 * result to one vendor's models.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { DEEPSEEK_MODEL, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-component-builder-deepseek-default",
  variant: "component-builder",
  runs: RUNS.capability,
  ...novita(DEEPSEEK_MODEL),
});
