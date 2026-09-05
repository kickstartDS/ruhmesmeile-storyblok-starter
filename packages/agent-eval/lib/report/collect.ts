/**
 * 1.14 — outcome records and local failure triage (PRD §7.5).
 *
 * We run on direct provider keys, so the harness's gateway classifier is
 * disabled and every failure arrives labelled only "failed". Without triage, a
 * Docker hiccup and a genuinely bad component are the same number, and the
 * quality gate would fire on infrastructure noise.
 *
 * Only `model` failures count toward pass rates and baselines.
 */

import { runQualityGraders, runDiagnosticGraders } from "../graders";
import { efficiencyOf, type Efficiency } from "../graders/efficiency";
import { costOf, type CostBreakdown } from "./cost";
import {
  mcpToolsWereDeferred,
  mcpUsageOf,
  stagingLeakOf,
  type McpUsage,
} from "../graders/mcp-usage";
import { qualityScore, type QualityScore } from "../graders/quality";
import { loadRun, listRuns, type Trial } from "../graders/trial";
import type { GraderResult } from "../graders/types";

export type FailureClass =
  | "model"
  | "infra"
  | "timeout"
  | "confounded"
  | "none";

export interface Outcome {
  experiment: string;
  variant: string;
  timestamp: string;
  evalName: string;
  run: number;
  runDir: string;
  /** The harness's own verdict — the in-sandbox vitest gate. */
  harnessPassed: boolean;
  failureClass: FailureClass;
  failureReason: string | null;
  durationSeconds: number;
  quality: QualityScore;
  graders: GraderResult[];
  diagnostics: GraderResult[];
  efficiency: Efficiency;
  mcp: McpUsage;
  /** Estimated USD for this trial — see `cost.ts` on why this is not output tokens. */
  cost: CostBreakdown;
}

const INFRA_SIGNATURES: Array<[RegExp, string]> = [
  [/rate.?limit/i, "provider rate limit"],
  [
    /\b5\d\d\b\s+(?:internal|server|bad gateway|service unavailable)/i,
    "provider 5xx",
  ],
  [/ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i, "network error"],
  [/docker.*(?:pull|daemon).*(?:fail|error)/i, "sandbox image failure"],
  [/MCP server.*(?:failed|error).*start/i, "MCP server failed to start"],
  [/npm ERR!.*(?:network|EAI_AGAIN)/i, "package install network failure"],
  [/Cannot find module/i, "sandbox dependency missing"],
];

/**
 * A missing module is only infrastructure when the *fixture* is missing it.
 *
 * TS2307 is TypeScript reporting that a file could not resolve an import, and
 * in this harness those files are the agent's own. When an agent writes
 * `Badge.stories.tsx` importing `@storybook/react-vite`, a package the fixture
 * does not ship, that is a choice it made and a cost it should carry — not a
 * broken sandbox. Classifying it as infra silently deleted the trial, which is
 * the expensive direction to be wrong in: it hides exactly the interaction we
 * are trying to measure, since the component-builder MCP hands out a Storybook
 * template and then the fixture cannot compile the result.
 *
 * A genuinely under-provisioned sandbox surfaces as Node's runtime
 * `ERR_MODULE_NOT_FOUND` / `Cannot find module`, never as TS2307.
 */
function missingModuleIsTheAgentsFault(haystack: string): boolean {
  const all = haystack.match(/Cannot find module/gi)?.length ?? 0;
  if (all === 0) return false;
  const ts2307 =
    haystack.match(/error TS2307: Cannot find module/gi)?.length ?? 0;
  return ts2307 >= all;
}

/**
 * Did this trial measure the thing its variant claims to measure?
 *
 * Unlike the other failure classes this is not about a trial going wrong — a
 * confounded trial usually looks *good*. The first full matrix (D-26) produced
 * a clean, plausible +0.18 quality win in which the MCP tools were never
 * exposed and the agent had read the servers off disk instead. Nothing in the
 * pipeline objected, because every individual number was real.
 *
 * So an MCP variant that *could not* reach an MCP is not a low score, it is not
 * a measurement at all, and it must not be averaged with ones that are.
 * `metrics.ts` and `grade.ts` keep only `model` and `none`, so returning this
 * class excludes the trial and prints why.
 *
 * "Could not" is load-bearing. Until D-149 the two were indistinguishable, so
 * every zero-call trial was excluded. Now that tools load upfront, a zero-call
 * trial is usually a model that *declined*, which is a finding rather than a
 * confound — see the intent-to-treat note below.
 */
function confound(
  trial: Trial,
  usage: McpUsage,
): { failureClass: FailureClass; reason: string } | null {
  if (trial.variant === "none" || trial.variant === "unknown") return null;
  if (!trial.transcript?.found) return null; // an infra problem, classified below

  const leak = stagingLeakOf(trial);
  if (leak?.kind === "read") {
    return {
      failureClass: "confounded",
      reason: `bypassed MCP and read the staged servers off disk — ${leak.input}`,
    };
  }
  // `leak.kind === "list"` is deliberately not confounding. Once the servers
  // actually worked, agents that used MCP properly still ran one `find` over
  // the runtime directory hunting for the design system to copy from — and
  // found an auth library. A path listing feeds no grader. It is reported by
  // `mcp-usage/no-staging-enumeration` and left in the sample.

  if (usage.applicable && usage.totalCalls === 0 && !usage.delegated) {
    // ...unless the eval is one where declining to call a server is the
    // correct answer. See `Target.mcpUseExpected`.
    if (!trial.target.mcpUseExpected) return null;
    // Deferred tools make "never called" ambiguous: the model may have been
    // unable to reach the server rather than unwilling. Say which.
    if (mcpToolsWereDeferred(trial)) {
      return {
        failureClass: "confounded",
        reason:
          "MCP tools were deferred behind ToolSearch and never loaded, so the " +
          "server was never callable — this trial measures the baseline, and " +
          "ENABLE_TOOL_SEARCH did not take effect",
      };
    }
    // Loaded upfront and still never called: the server was reachable and the
    // model declined it. That is a result, not a broken trial, and it stays in
    // the sample.
    //
    // Excluding it would select on the outcome. "Did the agent choose to call
    // the server" is correlated with "was the server any use here", so keeping
    // only the trials where it was called measures the MCP's value *given that
    // the agent wanted it* — which is not the question. The question is what
    // having the server available does, and declining to use it is part of
    // that answer. Intent-to-treat, not per-protocol.
    //
    // `mcp-usage/reached-mcp` still flags it, and the per-eval `mcp calls`
    // figure shows 0.0, so a silent decline stays visible.
    return null;
  }
  // A trial that handed its MCP calls to a subagent also reports zero, because
  // subagent turns never reach the transcript. That is our blind spot, not the
  // agent's shortcut, so it stays in the sample — see `delegationOf`.

  return null;
}

function classify(trial: Trial): {
  failureClass: FailureClass;
  reason: string | null;
} {
  if (trial.status === "passed") return { failureClass: "none", reason: null };

  const haystack = [trial.evalOutput ?? "", trial.transcript?.error ?? ""].join(
    "\n",
  );

  if (/timed out|timeout/i.test(haystack) && !trial.transcript?.found) {
    return {
      failureClass: "timeout",
      reason: "agent produced no transcript before the timeout",
    };
  }

  for (const [pattern, reason] of INFRA_SIGNATURES) {
    if (!pattern.test(haystack)) continue;
    if (
      reason === "sandbox dependency missing" &&
      missingModuleIsTheAgentsFault(haystack)
    ) {
      continue;
    }
    return { failureClass: "infra", reason };
  }

  // A trial with no transcript at all never really started.
  if (!trial.transcript?.found) {
    return { failureClass: "infra", reason: "no transcript captured" };
  }

  return { failureClass: "model", reason: null };
}

export function collectTrial(trial: Trial): Outcome {
  const graders = runQualityGraders(trial);
  const mcp = mcpUsageOf(trial);
  const efficiency = efficiencyOf(trial);

  // Checked before the pass/fail classifier: a confounded trial is just as
  // unusable when it passed as when it failed.
  const confounded = confound(trial, mcp);
  const { failureClass, reason } = confounded ?? classify(trial);

  return {
    experiment: trial.experiment,
    variant: trial.variant,
    timestamp: trial.timestamp,
    evalName: trial.evalName,
    run: trial.run,
    runDir: trial.runDir,
    harnessPassed: trial.status === "passed",
    failureClass,
    failureReason: reason,
    durationSeconds: trial.duration,
    quality: qualityScore(graders),
    graders,
    diagnostics: runDiagnosticGraders(trial),
    efficiency,
    mcp,
    cost: costOf(efficiency, trial.transcript?.summary?.observedModel),
  };
}

export function collectRun(experiment: string, timestamp: string): Outcome[] {
  return loadRun(experiment, timestamp).map(collectTrial);
}

/** The newest timestamped run of an experiment. */
export function latestRun(experiment: string): string | null {
  const runs = listRuns(experiment);
  return runs.length ? runs[runs.length - 1]! : null;
}
