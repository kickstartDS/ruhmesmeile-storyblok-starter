/**
 * Design Tokens MCP only, paste context. Haiku.
 *
 * The treatment cell for D-159. `cc-design-tokens-haiku-high` measures this
 * server against a workspace that already contains 1,575 greppable `--ks-*`
 * properties; entry there sat at 5 of 36 trials and three successive tool
 * descriptions failed to move it. That is a true finding about agents with a
 * checkout and was reported as if it were a finding about the server.
 *
 * Here the same server answers for the same two tasks with no token layer on
 * disk. The prediction, recorded before the run: entry approaches 3/3 on both
 * evals, the call mix inverts back toward lookup (`search_tokens`,
 * `get_token`, `list_tokens`) because names now have to come from somewhere,
 * and the `none` arm's `token-conformance` collapses while this one holds.
 *
 * If entry does *not* rise with the filesystem gone, then the server is not
 * being outcompeted by `grep` and every discoverability decision from D-155
 * onward was chasing the wrong cause.
 *
 * ── run 2, after D-160 ──
 *
 * That prediction held on `871` and the result is in D-160. It rested on one
 * eval, so `873-paste-responsive-tokens` was added; this note is its
 * pre-registration.
 *
 * `873` asks a question a lookup table cannot answer. `--ks-spacing-*` is
 * already breakpoint-scaled, so the correct fix deletes the component's media
 * queries rather than tokenising the values inside them — and 817's grader
 * scores those two things separately precisely so the half-answer is
 * distinguishable. Prediction: the `none` arm keeps its own breakpoints in 3/3
 * (it has no way to learn the scale is responsive) while this arm removes them
 * in at least 2/3; `get_token_architecture` or `get_token_hierarchy` appears
 * before any lookup call, because the fact needed is structural.
 *
 * Falsifier: if this arm also keeps the media queries, then what the server
 * conveys is token *names* and not design intent, and the "intent, not lookup"
 * claim in the front-door description — rewritten three times on that premise —
 * is unsupported.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";
import { evalsInTier } from "../lib/graders/targets";

export default defineExperiment({
  name: "cc-design-tokens-haiku-paste",
  variant: "design-tokens",
  model: "haiku",
  runs: RUNS.capability,
  effort: "high",
  evals: evalsInTier("paste"),
});
