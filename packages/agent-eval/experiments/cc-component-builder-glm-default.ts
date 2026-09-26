/**
 * component-builder MCP only. GLM 5.3 Flash via Novita, no effort flag.
 *
 * The strongest arm of every cohort run so far, and the clearest single test
 * this one makes. Its delta against `cc-none-glm-default` asks whether the
 * campaign's headline result survives a second change of vendor.
 *
 * Every measured delta, against each cohort's own baseline:
 *
 *   cohort        baseline   Δ        headroom   Δ / headroom
 *   sonnet-high   0.719      +0.226   0.281      0.80
 *   haiku-high    0.825      +0.093   0.175      0.53
 *   haiku-low     0.854      +0.079   0.146      0.54
 *   deepseek      0.906      +0.039   0.094      0.41
 *
 * Read as raw deltas the series looks like a decline needing an explanation.
 * Read against headroom it mostly stops moving: the server closes roughly half
 * of whatever distance the baseline left to a perfect score. Sonnet is the
 * outlier at 0.80, on fourteen counted trials, which is thin enough that the
 * honest summary is "0.4–0.55 with one noisy high reading".
 *
 * Pre-registration: **Δ ≈ 0.45 × (1 − baseline quality)**, with a band of
 * 0.35–0.60 on that ratio. This is the first arm in the campaign to predict a
 * ratio rather than a number, which is the point — it is falsifiable in a way
 * the previous three pre-registrations were not, and if it holds it converts
 * four scattered deltas into one claim with a mechanism behind it: the servers
 * supply what the repository cannot show, and how much that is worth depends
 * on how much the model was already getting wrong.
 *
 * The outcome that would matter most is unchanged from the DeepSeek arm: a
 * negative or zero delta would confine the campaign's headline result to
 * models that happen to be good at following MCP instructions, rather than to
 * the instructions being useful.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { GLM_MODEL, GLM_TIMEOUT, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-component-builder-glm-default",
  variant: "component-builder",
  runs: RUNS.capability,
  timeout: GLM_TIMEOUT,
  ...novita(GLM_MODEL),
});
