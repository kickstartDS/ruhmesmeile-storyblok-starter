/**
 * Both MCP servers: component-builder + design-tokens. Haiku.
 *
 * The upper bound of the Haiku matrix. Its delta against `cc-none-haiku-high`
 * is the combined contribution; the two single-server experiments then split
 * that contribution between the servers.
 *
 * On Sonnet this arm never beat component-builder alone, which is the finding
 * most worth re-testing here. If the two servers interfere — competing for
 * context, or pulling toward different answers — a weaker model should show it
 * more clearly, because it has less capacity to spare for reconciling them.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-both-haiku-high",
  variant: "both",
  model: "haiku",
  runs: RUNS.capability,
  effort: "high",
});
