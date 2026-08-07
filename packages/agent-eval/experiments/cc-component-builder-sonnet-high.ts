/**
 * Component Builder MCP only.
 *
 * Isolates the server that teaches structure: file layout, naming, purity,
 * BEM, and where client behaviour goes. The baseline sits at the floor on
 * `bem`, `purity` and `client-behaviour` in 6/6 trials, so this variant has the
 * clearest attribution path in the matrix — any movement in those three is this
 * server's doing.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-component-builder-sonnet-high",
  variant: "component-builder",
  runs: RUNS.capability,
  effort: "high",
});
