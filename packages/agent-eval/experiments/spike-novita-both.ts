/**
 * Novita feasibility spike — one eval, one arm, one run.
 *
 * This is not a measurement. Nothing it produces belongs in the report, and it
 * is deliberately named outside the `cc-{variant}-{model}-{context}` scheme so
 * that `buildCohorts()` cannot mistake it for an arm and `pnpm grade` cannot
 * average it into anything.
 *
 * It exists to answer one question before ~$90 of grid is committed: does
 * Claude Code, driving local MCP servers, against an endpoint that is not
 * Anthropic's, complete a trial *and produce the artefacts the whole pipeline
 * depends on*? A trial that finishes but yields no transcript is worse than
 * one that fails, because every downstream number — efficiency, cost, the
 * negative-usage graders, the call-mix analysis of D-160 — is computed from
 * the transcript, and their absence reads as zero rather than as missing.
 *
 * Four blockers were identified when the provider path was researched. The
 * spike is designed so that each one either shows up in `bin/spike-verify.ts`
 * or is provably not a blocker:
 *
 *   1. `cache_control` support. DeepSeek documents it as Ignored; Novita is
 *      unconfirmed. On the haiku-high campaign cache reads were 62% of spend
 *      and 184× output volume, so losing them does not make a provider cheaper
 *      — it plausibly doubles the bill. `cacheRead` in the transcript summary
 *      settles it: a number in the millions means caching works, a flat zero
 *      against a large `input` means it does not.
 *   2. `ModelTier` is a closed union. Resolved: the framework only forwards
 *      `--model <string>` to the CLI, so `DefineExperimentOptions.model` was
 *      widened and cast at the config boundary. No framework patch.
 *   3. Env must reach inside the sandbox. Resolved: the orchestrator hands the
 *      sandbox `authEnv() + neutralWorkspace.env` only, but
 *      `.claude/settings.local.json` has an `env` block already proven to work
 *      for `ENABLE_TOOL_SEARCH`. `providerEnv` rides it.
 *   4. Cost would be misattributed. NOT fixed, on purpose. `pricingFor()`
 *      substring-matches `claude-*` and falls back to Sonnet rates otherwise,
 *      so any cost this spike reports is fiction. Inventing a price row from a
 *      half-remembered rate card would bury that; leaving it lets
 *      `spike-verify` name it. Add the row when the provider's real rates have
 *      been read, not before.
 *
 * The acceptance test is the *observed model*, not the exit code. If settings
 * `env` loses to the `ANTHROPIC_API_KEY` the orchestrator sets on the process,
 * the run succeeds against real Anthropic Haiku and looks like a clean pass.
 * The transcript is the only thing that can tell those apart.
 *
 * Run it with:
 *
 *   NOVITA_API_KEY=… pnpm eval spike-novita-both --force
 *   pnpm spike:verify
 *
 * `both` rather than a single server, because the point is to exercise the MCP
 * plumbing hardest: two stdio servers proxied from the host, two sets of tool
 * names reaching the model, and `mcpToolCalls` non-empty at the end of it.
 * `812-restyle-with-tokens` because it is the cheapest eval that still calls
 * MCP — 11 turns and ~$0.44 a trial on haiku-high, against 29 turns and $1.27
 * for `810-atom-from-schema`.
 */

import { defineExperiment } from "../lib/experiment";

/**
 * Read at module load so a missing key fails before a sandbox is provisioned,
 * matching how `stageVariant()` fails on a missing MCP build. The alternative
 * is discovering it from inside a container after paying for `npm install`.
 */
const apiKey = process.env.NOVITA_API_KEY;
if (!apiKey) {
  throw new Error(
    "NOVITA_API_KEY is not set.\n" +
      "  NOVITA_API_KEY=… pnpm eval spike-novita-both --force\n" +
      "Get one at https://novita.ai — the spike is a single trial, a few cents.",
  );
}

/**
 * A real model name, not a tier alias.
 *
 * This is the concrete reason Novita is the better of the two providers to try
 * first. DeepSeek's Anthropic-compatible endpoint *name-maps* instead: it
 * routes `claude-opus` to their large model and both `claude-sonnet` **and**
 * `claude-haiku` to `deepseek-flash`. Under that mapping an arm labelled
 * haiku silently benchmarks their small model, and — worse for us — the
 * transcript may still report a `claude-*` string, which `pricingFor()` would
 * then match and price at Anthropic rates. Novita takes the model name
 * verbatim, so the transcript names what actually ran.
 */
const MODEL = process.env.NOVITA_MODEL ?? "moonshotai/kimi-k2-instruct";

export default defineExperiment({
  name: "spike-novita-both",
  variant: "both",
  model: MODEL,
  runs: 1,
  evals: ["812-restyle-with-tokens"],
  // No `effort`. The harness turns it into `--effort low|medium|high` on the
  // CLI, and a third-party endpoint rejecting or mishandling that flag would
  // fail the spike for a reason unrelated to what it is testing. The effort
  // axis can be added once the endpoint is known to work at all.
  providerEnv: {
    ANTHROPIC_BASE_URL: "https://api.novita.ai/anthropic",
    ANTHROPIC_AUTH_TOKEN: apiKey,
    // Emptied so the orchestrator's own key cannot be the one that answers.
    // If the endpoint is reached anyway with this blank, that is the finding.
    ANTHROPIC_API_KEY: "",
    // Claude Code routes cheap internal work — title generation, file summaries
    // — to a small model. Left pointing at Anthropic it would keep a second,
    // unmeasured provider in the loop and muddy both the cost and the
    // transcript.
    ANTHROPIC_MODEL: MODEL,
    ANTHROPIC_SMALL_FAST_MODEL: MODEL,
  },
});
