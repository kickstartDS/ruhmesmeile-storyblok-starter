/**
 * Baseline: no MCP servers.
 *
 * Everything every other experiment measures is measured against this run. It
 * must stay the least-privileged variant in the matrix — no MCP servers, no
 * agent instructions, no web research.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-none-sonnet-high",
  variant: "none",
  runs: RUNS.capability,
  effort: "high",
});
