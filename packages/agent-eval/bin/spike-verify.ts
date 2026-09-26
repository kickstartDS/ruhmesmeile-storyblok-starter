#!/usr/bin/env tsx
/**
 * Did the Novita spike actually work?
 *
 *   pnpm spike:verify [experiment]        # default: spike-novita-both
 *
 * A trial that exits zero proves very little here. The pipeline this campaign
 * runs on reads almost nothing from the agent's exit code and almost
 * everything from the transcript: token counts, cost, the call-mix analysis,
 * the negative-usage graders that check the agent *did not* do something. All
 * of those degrade to a plausible-looking zero when the transcript is missing,
 * so "the run passed" and "the run is measurable" are independent facts and
 * this checks the second one.
 *
 * Each check prints PASS, FAIL, or WARN. WARN is for findings that are real
 * but not disqualifying — a provider without prompt caching still produces
 * valid quality numbers, it just costs more than the model it is replacing.
 */

import { collectTrial } from "../lib/report/collect";
import { pricingFor } from "../lib/report/cost";
import { loadEval, resolveMatrix } from "../lib/graders/trial";

const experiment = process.argv[2] ?? "spike-novita-both";

type Status = "PASS" | "FAIL" | "WARN";
const results: { status: Status; label: string; detail: string }[] = [];

function check(status: Status, label: string, detail: string): void {
  results.push({ status, label, detail });
}

const entries = resolveMatrix(experiment);
if (!entries.length) {
  console.error(
    `No results for "${experiment}". Run it first:\n` +
      `  NOVITA_API_KEY=… pnpm eval ${experiment} --force`,
  );
  process.exit(1);
}

const trials = entries.flatMap((entry) =>
  loadEval(experiment, entry.timestamp, entry.evalName),
);
const trial = trials[0]!;

console.log(`${experiment} — ${trial.evalName} run-${trial.run}`);
console.log(`${trial.runDir}\n`);

// ── 1. the trial ran at all ────────────────────────────────────────────────
const outcome = collectTrial(trial);
check(
  outcome.failureClass === "none" || outcome.failureClass === "model"
    ? "PASS"
    : "FAIL",
  "trial completed",
  `harnessPassed=${outcome.harnessPassed} failureClass=${outcome.failureClass}` +
    (outcome.failureReason ? ` — ${outcome.failureReason}` : ""),
);

// A model failure is a fine outcome for a spike: the endpoint answered, the
// agent worked the task, it just did not pass. An infra failure is not.
if (outcome.failureClass !== "none" && outcome.failureClass !== "model") {
  check(
    "FAIL",
    "failure is the model's, not the plumbing's",
    "an infra-class failure means the provider path itself broke",
  );
}

// ── 2. transcript capture ──────────────────────────────────────────────────
const meta = trial.transcript;
check(
  meta?.found ? "PASS" : "FAIL",
  "transcript captured",
  meta?.found
    ? `${meta.bytes ?? 0} bytes at ${meta.sourcePath ?? "?"}`
    : `not found — ${meta?.error ?? "no error recorded"}` +
        (meta?.searched?.length
          ? ` (searched ${meta.searched.length} paths)`
          : ""),
);

const summary = meta?.summary;
if (!summary) {
  check(
    "FAIL",
    "transcript parsed",
    "no summary — every downstream metric would read as zero",
  );
  report();
}

// ── 3. what actually answered ──────────────────────────────────────────────
// The headline question. Settings `env` may lose to the ANTHROPIC_API_KEY the
// orchestrator sets on the process, in which case this ran on real Anthropic
// and every other check below would pass while measuring the wrong thing.
const observed = summary!.observedModel;
const looksAnthropic = (observed ?? "").toLowerCase().includes("claude");
check(
  observed ? (looksAnthropic ? "FAIL" : "PASS") : "FAIL",
  "observed model is the provider's",
  observed
    ? looksAnthropic
      ? `"${observed}" — settings env did not win; this ran on Anthropic`
      : `"${observed}"`
    : "null — the transcript never named a model",
);

// ── 4. token accounting ────────────────────────────────────────────────────
// `summary.tokens` comes from the in-sandbox summariser, which sums every
// transcript line carrying a `usage` block. Claude Code repeats one
// `message.id` across several lines — once per content block — with identical
// usage on each, so that sum counts each API call ~3.6× (79 lines for 22
// calls on the DeepSeek spike). `efficiencyOf` deduplicates by message id and
// is what the report bills on, so verify the number the report uses, not the
// one the sandbox wrote (D-173).
const { input, output, cacheRead, cacheWrite } = outcome.efficiency.tokens;
const fmt = (n: number) => (n / 1_000_000).toFixed(2) + "M";
check(
  output > 0 ? "PASS" : "FAIL",
  "token accounting",
  `in ${fmt(input)} · out ${fmt(output)} · cacheR ${fmt(cacheRead)} · cacheW ${fmt(cacheWrite)}` +
    ` over ${outcome.efficiency.turns} call(s) — est. $${outcome.cost.total.toFixed(6)}`,
);

// Blocker 1. On haiku-high, cache reads were 62% of spend and 184× the output
// volume — so a provider that ignores cache_control is not cheaper, it is
// roughly twice the price. Zero cache against non-trivial input is the tell.
check(
  cacheRead > 0 || cacheWrite > 0 ? "PASS" : input > 100_000 ? "WARN" : "PASS",
  "prompt caching honoured",
  cacheRead > 0 || cacheWrite > 0
    ? `cache traffic present — cacheR/out ratio ${(cacheRead / Math.max(output, 1)).toFixed(0)}×`
    : `no cache traffic against ${fmt(input)} input — expect ~2× the Haiku bill, not less`,
);

// ── 5. MCP reached the model ───────────────────────────────────────────────
const mcpNames = Object.keys(summary!.mcpToolCalls);
check(
  summary!.mcpToolCallCount > 0 ? "PASS" : "FAIL",
  "MCP tools called",
  summary!.mcpToolCallCount > 0
    ? `${summary!.mcpToolCallCount} call(s) across ${mcpNames.length} tool(s): ${mcpNames.slice(0, 4).join(", ")}`
    : "zero — the servers were staged and proxied but the model never called them",
);

// ── 6. the deny list survived ──────────────────────────────────────────────
// Every variant denies web research, because a control that can fetch the
// design system the MCP servers encode is not a control. The deny rules live
// in the same settings file the provider env now shares, so a provider run is
// also a re-test of that file taking effect.
const web = ["WebSearch", "WebFetch"].filter((t) => summary!.toolCalls[t]);
check(
  web.length === 0 ? "PASS" : "FAIL",
  "web research denied",
  web.length === 0
    ? "no WebSearch/WebFetch calls"
    : `leaked: ${web.join(", ")}`,
);

// ── 7. graders produced a score ────────────────────────────────────────────
check(
  typeof outcome.quality?.score === "number" ? "PASS" : "FAIL",
  "graders ran",
  typeof outcome.quality?.score === "number"
    ? `quality ${outcome.quality.score.toFixed(3)} (weights v${outcome.quality.weightsVersion}) across ${Object.keys(outcome.quality.dimensions).length} dimension(s)`
    : "no quality score — the graders could not read this trial",
);

// ── 8. cost attribution ────────────────────────────────────────────────────
// Blocker 4, deliberately unfixed. `pricingFor()` matches `claude-*` and falls
// back to Sonnet rates for anything else, so a non-Anthropic model is priced
// at $3/$15 per Mtok regardless of what it really costs. Left visible rather
// than papered over with a guessed price row.
const priced = pricingFor(observed);
const sonnet = pricingFor("claude-sonnet");
const isFallback =
  priced.input === sonnet.input &&
  priced.output === sonnet.output &&
  !looksAnthropic;
check(
  isFallback ? "WARN" : "PASS",
  "cost attribution",
  isFallback
    ? `"${observed}" has no PRICING row — billed at Sonnet's $${priced.input}/$${priced.output} per Mtok. ` +
        `Every cost figure for this arm is fiction until a real row is added.`
    : `$${priced.input}/$${priced.output} per Mtok`,
);

report();

function report(): never {
  const width = Math.max(...results.map((r) => r.label.length));
  console.log();
  for (const { status, label, detail } of results) {
    const mark = status === "PASS" ? "✓" : status === "WARN" ? "!" : "✗";
    console.log(`  ${mark} ${label.padEnd(width)}  ${detail}`);
  }

  const failed = results.filter((r) => r.status === "FAIL").length;
  const warned = results.filter((r) => r.status === "WARN").length;
  console.log(
    `\n${results.length - failed - warned} passed, ${warned} warning(s), ${failed} failure(s).`,
  );

  if (failed === 0) {
    console.log(
      "\nThe provider path is measurable. Before committing to a full grid,\n" +
        "settle the cost question separately — the warnings above are the\n" +
        "difference between cheaper and twice the price.",
    );
  }

  process.exit(failed === 0 ? 0 : 1);
}
