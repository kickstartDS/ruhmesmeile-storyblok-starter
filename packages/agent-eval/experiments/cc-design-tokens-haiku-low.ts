/**
 * Design Tokens MCP only. Haiku, low effort.
 *
 * Isolates the server that supplies token names and the layer architecture.
 *
 * This server has been the campaign's persistent near-null: +0.04 on
 * `sonnet-high`, +0.02 on `haiku-high`, and on Sonnet it flipped no task
 * outcome at all (ADR 62) despite moving `token-conformance` reliably. D-160
 * found the one context where it does decide outcomes — the `paste` fixture,
 * which ships no `src/token/` and so leaves nothing to grep: there, baseline
 * failed token-conformance 3/3 and this server failed 0/3.
 *
 * That result reframes the null. If the server's value is recoverable lookup —
 * information the agent can obtain by reading the repo instead — then it should
 * be worth nothing whenever the repo is present and the agent can afford to go
 * looking, and worth something the moment either condition fails. Low effort
 * removes the second condition while leaving the first intact, which is a test
 * `paste` could not run.
 *
 * Pre-registration: delta exceeds the +0.02 of `haiku-high`. A low-effort agent
 * should budget fewer turns for exploratory reading, and a server that answers
 * in one call what grepping answers in six is worth most exactly then. A delta
 * still pinned near zero would mean the agent is not in fact trading reading
 * for deliberation, and the server's value stays confined to contexts where the
 * tokens are genuinely absent — a narrower claim, but a cleanly evidenced one.
 *
 * Check the call mix, not just the score. D-160's signal was compositional: on
 * `paste` the lookup calls went 4 → 23 while judgement calls held at 25 → 27.
 * If that inversion reappears here, the mechanism is confirmed independently of
 * whether the quality delta clears significance.
 */

import { RUNS } from "../agent-eval.config";
import { defineExperiment } from "../lib/experiment";

export default defineExperiment({
  name: "cc-design-tokens-haiku-low",
  variant: "design-tokens",
  model: "haiku",
  runs: RUNS.capability,
  effort: "low",
});
