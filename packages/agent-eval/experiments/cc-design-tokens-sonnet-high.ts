/**
 * Design Tokens MCP only.
 *
 * Isolates the server that supplies token names and the layer architecture.
 * The baseline invents plausible-looking tokens in every trial (`--space-3xs`,
 * `--font-family-base`, `--c-badge-bg`) and falls back to hex literals, so
 * `token-conformance` is the grader this variant should move.
 *
 * Worth watching: this server exposes 29 tools against the component builder's
 * 7. If tool-count alone drives context cost, the efficiency numbers will show
 * it here first.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-design-tokens-sonnet-high",
  variant: "design-tokens",
  runs: RUNS.capability,
  effort: "high",
});
