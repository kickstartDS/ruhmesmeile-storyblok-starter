/**
 * Baseline, paste context. Haiku.
 *
 * The control for `cc-design-tokens-haiku-paste`: same two tasks, same absent
 * token layer, no servers. An agent here has its snippet, its own memory of
 * kickstartDS, and nothing else.
 *
 * This arm is expected to score badly, and that expectation is the point. In
 * the repo context the baseline can recover almost everything the design-tokens
 * server offers by reading `src/token/`, which is why three campaigns found the
 * server changed no outcome (ADR 62, D-158). If the same server produces a
 * large delta here, its value was never absent — it was masked by a filesystem
 * that only some users have (D-159).
 *
 * Paired with `cc-design-tokens-haiku-paste` and with the repo-context arms
 * `cc-none-haiku-high` / `cc-design-tokens-haiku-high`, which run `811` and
 * `818` — the same tasks with the layer present. Four cells, one variable each
 * way. Results live in their own directory and must never be averaged with the
 * repo arms.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { evalsInTier } from "../lib/graders/targets";

export default defineExperiment({
  name: "cc-none-haiku-paste",
  variant: "none",
  model: "haiku",
  runs: RUNS.capability,
  effort: "high",
  // Named explicitly: `defaultEvals()` returns the core tier and
  // `EVAL_EXTRA_EVALS=1` widens it to `extra`. Neither reaches `paste`, so
  // these evals can only ever run from an experiment that asks for them.
  evals: evalsInTier("paste"),
});
