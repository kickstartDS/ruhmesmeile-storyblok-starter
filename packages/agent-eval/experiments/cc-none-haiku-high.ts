/**
 * Baseline: no MCP servers. Haiku.
 *
 * The floor of the Haiku matrix, and the term every other Haiku experiment is
 * measured against. It must stay the least-privileged variant — no MCP servers,
 * no agent instructions, no web research — so that `cc-*-haiku-high` deltas
 * mean the same thing as `cc-*-sonnet-high` deltas.
 *
 * Cross-model comparison is only ever read within a variant: `none` against
 * `none`, `both` against `both`. Comparing a Haiku arm to a Sonnet arm of a
 * different variant confounds the two things the campaign exists to separate.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-none-haiku-high",
  variant: "none",
  model: "haiku",
  runs: RUNS.capability,
  effort: "high",
});
