/**
 * design-tokens MCP only. DeepSeek v4.1 Flash via Novita, no effort flag.
 *
 * The arm with the weakest record in the campaign: +0.025 on `haiku-low` and
 * +0.024 on `haiku-high` — a 0.001 difference that D-169 recorded as failing
 * its pre-registration, which had predicted the effect would grow as the model
 * got cheaper. On Sonnet the arm scored *below* its own baseline.
 *
 * D-160 is the reason it stays in the matrix rather than being dropped: in the
 * paste context, where the fixture ships no `src/token/` and there is nothing
 * to grep, design-tokens has a measured outcome effect. The repo cohorts keep
 * finding nothing because the information the server provides is already on
 * disk, and a model that can read it does not need to be told it.
 *
 * That makes this arm the cohort's most informative one on a different
 * question: a token-hungry endpoint that greps less, or reads less
 * successfully, should get more out of an MCP server that hands it the answer.
 * The spike's token profile already shows this model behaving unlike Haiku —
 * uncached input dominates where Haiku's bill was 62% cache reads.
 *
 * Pre-registration: positive but small, in the same 0.02–0.03 band as both
 * Haiku cohorts, and below component-builder's delta. A materially larger
 * effect here would be the first evidence that the repo-context null is a
 * property of the *model's* ability to find things itself rather than a
 * property of the server.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { DEEPSEEK_MODEL, novita } from "../lib/providers";

export default defineExperiment({
  name: "cc-design-tokens-deepseek-default",
  variant: "design-tokens",
  runs: RUNS.capability,
  ...novita(DEEPSEEK_MODEL),
});
