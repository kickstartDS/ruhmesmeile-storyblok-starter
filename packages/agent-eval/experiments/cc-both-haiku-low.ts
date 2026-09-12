/**
 * Both MCP servers: component-builder + design-tokens. Haiku, low effort.
 *
 * The upper bound of the `haiku-low` cohort. Its delta against
 * `cc-none-haiku-low` is the combined contribution; the two single-server
 * experiments then split that contribution between the servers.
 *
 * On `haiku-high` this arm scored +0.09, exactly tying component-builder alone
 * — the second cohort in a row where adding design-tokens on top of
 * component-builder bought nothing (on Sonnet, `both` also never beat
 * component-builder). Two cohorts is a pattern; a third would make it the
 * campaign's most robust negative result.
 *
 * Pre-registration: `both` again ties or trails `component-builder` here. The
 * interference hypothesis predicts it trails more clearly than on `haiku-high`
 * — a low-effort agent has the least capacity to spare for reconciling two
 * servers competing for the same context budget, so if the two ever conflict
 * this is the cohort where it should surface. A `both` arm that *beats*
 * component-builder here, having failed to do so at high effort on two models,
 * would invert the reading: the servers would be complements that only pay off
 * when the agent cannot afford to derive the missing half itself.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-both-haiku-low",
  variant: "both",
  model: "haiku",
  runs: RUNS.capability,
  effort: "low",
});
