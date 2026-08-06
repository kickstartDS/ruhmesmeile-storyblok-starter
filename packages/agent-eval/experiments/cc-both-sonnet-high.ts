/**
 * Both MCP servers: component-builder + design-tokens.
 *
 * The upper bound of the matrix. Its delta against `cc-none-sonnet-high` is the
 * combined contribution; the single-server experiments (P1) then split that
 * contribution between the two servers.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-both-sonnet-high",
  variant: "both",
  runs: RUNS.capability,
  effort: "high",
});
