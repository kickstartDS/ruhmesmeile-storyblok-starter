/**
 * Component Builder MCP only. Haiku, low effort.
 *
 * Isolates the server that teaches structure: file layout, naming, purity, BEM,
 * and where client behaviour goes.
 *
 * This is the cohort's headline arm. Structural instruction is the clearest
 * case of a server *substituting* for deliberation — the conventions it hands
 * over are precisely what an agent would otherwise have to reason its way to —
 * so the substitution hypothesis predicts its delta grows as effort falls.
 *
 * The trend so far runs the other way, and that is what makes this worth
 * buying: the arm scored +0.23 on `sonnet-high` and +0.09 on `haiku-high`, so
 * the delta has been shrinking as the agent gets weaker, not growing. If it
 * shrinks again at low effort, the server needs a capable agent to exploit it,
 * and its value is a multiplier on model quality rather than a floor under it —
 * which would make "use the cheap model, it has the server" exactly backwards
 * as deployment advice.
 *
 * Pre-registration: delta lands below +0.09, continuing the decline. The
 * informative alternative is a delta at or above the `sonnet-high` +0.23, which
 * would mean effort and model capability are not interchangeable and the
 * shrinkage seen on Haiku was about model capability alone.
 *
 * Watch `802-composite-from-two` specifically. It is the only task anywhere in
 * the suite where this server alone goes materially negative (−0.16 on
 * `haiku-high`) while `both` stays flat. If that reverses at low effort, the
 * regression is about the agent over-riding the server's guidance when it has
 * budget to second-guess it.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-component-builder-haiku-low",
  variant: "component-builder",
  model: "haiku",
  runs: RUNS.capability,
  effort: "low",
});
