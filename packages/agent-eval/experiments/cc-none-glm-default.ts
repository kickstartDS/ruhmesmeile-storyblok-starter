/**
 * No MCP servers. GLM 5.3 Flash via Novita, no effort flag.
 *
 * The cohort's baseline, and the number every other GLM arm is measured
 * against. Its only job is to say what this model does with the fixture alone.
 *
 * That job has grown more interesting than it sounds. The `none` baselines
 * measured so far — 0.719 on Sonnet, 0.825 and 0.854 on the two Haiku cohorts,
 * 0.906 on DeepSeek — do not order by model price or reputation, and the
 * cheapest model tested has the strongest baseline. Reading
 * `802-composite-from-two/run-2` explains the mechanism: a `none` arm is not an
 * ignorant arm. The fixture ships two complete sibling components and the whole
 * token tree, and DeepSeek spent 19 of its 24 tool calls reverse-engineering
 * the conventions out of them — reading both exemplars in full, then
 * enumerating legal token names with `grep -oE` per category. A baseline
 * therefore measures how well a model mines a repository, which is a different
 * skill from knowing the design system and one a cheap fast model can be good
 * at.
 *
 * Pre-registration: 0.85–0.92, the band the other `flash`-class models occupy,
 * rather than near Sonnet's 0.719. A baseline *below* 0.80 would be the
 * informative outcome — it would mean the spread across the four existing
 * cohorts is not about repository-mining skill after all, and the ceiling story
 * the MCP deltas are about to be read through would need rebuilding.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { GLM_MODEL, GLM_TIMEOUT, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-none-glm-default",
  variant: "none",
  runs: RUNS.capability,
  timeout: GLM_TIMEOUT,
  ...novita(GLM_MODEL),
});
