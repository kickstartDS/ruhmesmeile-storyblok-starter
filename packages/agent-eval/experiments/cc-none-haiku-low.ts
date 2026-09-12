/**
 * Baseline: no MCP servers. Haiku, low reasoning effort.
 *
 * The floor of the `haiku-low` cohort, and the term every other `-haiku-low`
 * experiment is measured against. It must stay the least-privileged variant —
 * no MCP servers, no agent instructions, no web research — so that
 * `cc-*-haiku-low` deltas mean the same thing as `cc-*-haiku-high` deltas.
 *
 * `low` is the first non-`high` effort the campaign has run: all ten prior
 * experiments pinned `effort: "high"`, so the entire suite has measured a
 * single point on the deliberation axis and generalised from it — the same
 * defect D-159 found on the deployment-context axis.
 *
 * Effort is a *cohort* key, not a variant key. Deltas are read within
 * `haiku-low`, never against `haiku-high`, because a cheaper agent shifts the
 * baseline as well as the treatment. The cross-cohort read that *is* legitimate
 * is the comparison of deltas — `both`'s +0.09 on `haiku-high` against whatever
 * `both` scores here.
 *
 * Pre-registration: absolute quality falls from the 0.83 `cc-none-haiku-high`
 * baseline. If it does not, `high` was buying nothing on the baseline arm and
 * the campaign's effort pin was a waste of spend rather than a control.
 *
 * Cost is not the motive and should not be claimed as one. Measured across the
 * 240 `haiku-high` trials, output tokens — the only component reasoning effort
 * governs — were 17.5% of the bill ($7.99 of $45.77); cache read alone was
 * 62.4%. Expect this cohort to cost roughly what `haiku-high` cost. A large
 * *drop* would mean effort was also suppressing turns, and a large *rise* would
 * mean a less deliberate agent needs more of them; both are findings about
 * turn count, which is what cache traffic actually prices.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-none-haiku-low",
  variant: "none",
  model: "haiku",
  runs: RUNS.capability,
  effort: "low",
});
