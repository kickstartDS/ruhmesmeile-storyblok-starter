/**
 * Both MCP servers. GLM 5.3 Flash via Novita, no effort flag.
 *
 * Whether the two servers add up. On every cohort so far they have not: `both`
 * ties `component-builder` on quality and never beats it by more than noise —
 * 0.944 against 0.945 on Sonnet, 0.919 against 0.918 on `haiku-high`, 0.924
 * against 0.933 on `haiku-low`, 0.945 against 0.945 on DeepSeek. Four cohorts,
 * four ties. design-tokens contributes nothing on top of component-builder
 * that component-builder was not already supplying.
 *
 * The one place `both` has separated is pass@1 rather than quality: on DeepSeek
 * it reached 85% against component-builder's 80%, the cohort's best. Quality is
 * a mean over graders and pass@1 is a gate, so the two can move apart when a
 * server fixes the specific things that fail a build without much shifting the
 * average. Whether that 5-point gap is real or three trials of luck is a
 * question this cohort can answer for the first time, because it will be the
 * second independent look at it.
 *
 * Pre-registration: quality within ±0.01 of `cc-component-builder-glm-default`
 * — a tie, predicted for the fifth time. On pass@1, equal to or above
 * component-builder. And cost between component-builder's and design-tokens',
 * since it pays design-tokens' call volume for component-builder's effect.
 *
 * A `both` arm that clearly *beat* component-builder here would be the first
 * evidence the servers compose rather than overlap, and would make the case
 * for shipping them together rather than recommending one.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { GLM_MODEL, GLM_TIMEOUT, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-both-glm-default",
  variant: "both",
  runs: RUNS.capability,
  timeout: GLM_TIMEOUT,
  ...novita(GLM_MODEL),
});
