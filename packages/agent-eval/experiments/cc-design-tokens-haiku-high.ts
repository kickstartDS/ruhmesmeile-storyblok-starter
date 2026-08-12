/**
 * Design Tokens MCP only. Haiku.
 *
 * Isolates the server that supplies token names and the layer architecture.
 *
 * The Sonnet campaign found this server never flipped a task — it moved
 * `token-conformance` reliably but changed no outcome (ADR 62). That result is
 * the interesting one to re-test on a weaker model: a server that only helps an
 * agent already capable of the task is worth less than one that raises an agent
 * that would otherwise fail, and Sonnet may simply have known the token names
 * already. If the design-tokens delta is larger on Haiku than on Sonnet, the
 * server's value is a function of the model it assists.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-design-tokens-haiku-high",
  variant: "design-tokens",
  model: "haiku",
  runs: RUNS.capability,
  effort: "high",
});
