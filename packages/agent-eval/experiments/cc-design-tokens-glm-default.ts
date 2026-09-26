/**
 * design-tokens MCP only. GLM 5.3 Flash via Novita, no effort flag.
 *
 * The weakest arm everywhere it has run, and the one whose cost profile is
 * worst. Its deltas: +0.023 on Sonnet, +0.024 on `haiku-high`, +0.025 on
 * `haiku-low`, +0.009 on DeepSeek — remarkably flat across three very
 * different models, and then smaller on the strongest baseline.
 *
 * On DeepSeek it was also the most expensive arm of the cohort: $0.061/trial
 * against the baseline's $0.038, for 14.7 MCP calls and +0.009 quality. That
 * is a 60% cost premium for a delta inside the noise, and it is the clearest
 * case the campaign has produced of a server that is used heavily and pays for
 * little.
 *
 * The explanation is not that the model ignores it — 14.7 calls says otherwise.
 * It is that the token names are already in the repository and cheap to
 * recover: reading `802-composite-from-two/run-2`, the `none` arm enumerated
 * every legal token with five `grep -oE` calls against `src/token/*.scss` and
 * scored 1.00 on token-conformance without touching an MCP. The server is
 * answering a question the fixture already answers. D-160 found the exception
 * — the `paste` context, where there is no `src/token/` to grep and the
 * design-tokens delta is real — which is exactly the shape this reading
 * predicts.
 *
 * Pre-registration: positive but small, 0.00–0.02, and below
 * `cc-component-builder-glm-default`'s delta. Also predicted: the highest
 * $/trial in the cohort, and an MCP call count an order of magnitude above
 * component-builder's ~3, continuing a pattern where the server that is called
 * most contributes least.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { GLM_MODEL, GLM_TIMEOUT, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-design-tokens-glm-default",
  variant: "design-tokens",
  runs: RUNS.capability,
  timeout: GLM_TIMEOUT,
  ...novita(GLM_MODEL),
});
