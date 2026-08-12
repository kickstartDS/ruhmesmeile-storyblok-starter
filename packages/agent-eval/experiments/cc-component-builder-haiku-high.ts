/**
 * Component Builder MCP only. Haiku.
 *
 * Isolates the server that teaches structure: file layout, naming, purity, BEM,
 * and where client behaviour goes.
 *
 * On Sonnet this was the value leader by 2–12× at the lowest cost multiplier,
 * and it beat `both` on `832` outright (ADR 62). Whether that holds on a weaker
 * model is the campaign's headline question: structural instruction is exactly
 * the kind of help that should matter more the less the agent already knows, so
 * the expected result is a *larger* delta than Sonnet's. A smaller one would be
 * the more informative outcome — it would mean the server assumes competence it
 * also has to supply.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-component-builder-haiku-high",
  variant: "component-builder",
  model: "haiku",
  runs: RUNS.capability,
  effort: "high",
});
