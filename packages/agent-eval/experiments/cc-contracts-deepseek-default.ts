/**
 * Contracts: the two MCP servers, pointed at the generated component contracts.
 *
 * The arm under test for the contracts PRD (Phase 5). It is `cc-both` plus one
 * environment variable: `DESIGN_SYSTEM_CONTRACTS_DIR` makes both servers expose
 * their contract tools (`get_component_brief`, `get_prop_visual_impact`,
 * `get_component_anatomy`, `get_component_contract`, `lint_component_contracts`,
 * `list_component_contracts`, and design-tokens' `get_token_usage`). Without the
 * variable the same processes withhold those tools, which is what makes this a
 * real arm rather than a relabelled `both` — see `lib/mcp/variants.ts`.
 *
 * The contracts themselves are folded into `variantVersion`, so regenerating
 * `packages/design-system/contracts` invalidates this arm and no other.
 *
 * Pre-registration: on the contract-relevant evals this must beat
 * `cc-both-deepseek-default`, which is the only arm that has ever been measured
 * against this server pair. If it ties, the format's value is unproven and the
 * format changes before it ships further (ADR: component contracts, Decision 9).
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { DEEPSEEK_MODEL, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-contracts-deepseek-default",
  variant: "contracts",
  runs: RUNS.capability,
  ...novita(DEEPSEEK_MODEL),
});
