/**
 * Contracts: the two MCP servers, pointed at the generated component contracts.
 * GLM 5.3 Flash via Novita, no effort flag — the `glm-default` cohort.
 *
 * The counterpart to `cc-contracts-deepseek-default`, and the arm that joins the
 * cohort the other four glm arms were run in (`cc-none-glm-default`,
 * `cc-component-builder-glm-default`, `cc-design-tokens-glm-default`,
 * `cc-both-glm-default`). Running a contracts arm in a different cohort would
 * compare it against a different model, which is the one comparison this
 * package exists to avoid.
 *
 * `cc-both-glm-default` pre-registered a tie with `cc-component-builder` — four
 * cohorts, four ties — so the question here is not "do the servers add up" but
 * "does the contract layer add anything the servers' own tools do not". It is
 * the first arm in the campaign whose tools carry prop→visual causality:
 * `bindings[].mechanism`, the api ↔ class ↔ token-segment join, and resolved
 * token names.
 *
 * Pre-registration: quality at or above `cc-both-glm-default` on the
 * contract-relevant evals (`812-restyle-with-tokens`, `840-reuse-over-native`,
 * `811-token-intent`, `818-component-token-layer`, `842-reuse-edit`,
 * `861-token-restraint`), and no worse elsewhere. Ties or trailing on those
 * evals means the format is not paying for itself and the format changes before
 * it ships further (ADR: component contracts, Decision 9).
 *
 * Known bias, stated rather than buried: the two servers' "call me first"
 * documents do not yet mention the contract tools, so discovery rests on the
 * tool descriptions alone (the tool list is handed to the model upfront). A
 * null result therefore has two possible readings — the format is unhelpful, or
 * it was not discovered — and the discovery text is a separate, later cohort
 * rather than a change to this one.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { GLM_MODEL, GLM_TIMEOUT, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-contracts-glm-default",
  variant: "contracts",
  runs: RUNS.capability,
  timeout: GLM_TIMEOUT,
  ...novita(GLM_MODEL),
});
