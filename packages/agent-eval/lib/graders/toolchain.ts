/**
 * 1.8 — toolchain, and 1.10 — accessibility.
 *
 * Both read the JSON reports `EVAL.ts` writes in-sandbox. Neither can be
 * computed from a file snapshot: one needs a compiler and the other needs a
 * DOM. When a report is missing the grader reports not-applicable rather than
 * failing — a missing report means the sandbox never got far enough to write
 * one, which is infrastructure, not the model's fault.
 */

import {
  check,
  partial,
  result,
  notApplicable,
  type GraderResult,
} from "./types";
import { readFile, type Trial } from "./trial";

interface StepResult {
  ran: boolean;
  ok: boolean;
  detail: string;
}

interface ToolchainReport {
  typecheck: StepResult;
  styles: StepResult;
}

interface RuntimeReport {
  rendered: boolean;
  reason: string | null;
  html?: string;
  violations: Array<{ id: string; impact: string | null; nodes: number }>;
}

function readReport<T>(trial: Trial, name: string): T | null {
  const raw = readFile(trial, name) ?? readFile(trial, `project/${name}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function toolchain(trial: Trial): GraderResult {
  const report = readReport<ToolchainReport>(trial, "toolchain-report.json");
  if (!report) {
    return notApplicable(
      "toolchain",
      "toolchain",
      "no toolchain report — validation did not reach the reporting step",
    );
  }

  const checks = [
    check(
      "typecheck",
      "the package typechecks",
      report.typecheck.ok,
      report.typecheck.ok ? undefined : firstLines(report.typecheck.detail),
    ),
  ];

  // Only score the compile when there was something to compile. A missing
  // stylesheet is `component-contract`'s finding; counting it here too would
  // penalise one mistake in two dimensions.
  if (report.styles.ran) {
    checks.push(
      check(
        "styles-compile",
        "the stylesheet compiles",
        report.styles.ok,
        report.styles.ok ? undefined : firstLines(report.styles.detail),
      ),
    );
  }

  return result("toolchain", "toolchain", checks);
}

/** Serious and critical violations are the bar; minor ones are informational. */
const BLOCKING_IMPACTS = new Set(["critical", "serious"]);

/** Reasons that mean "the agent produced nothing to render", not "it renders badly". */
const NOTHING_TO_RENDER = /^no component (was written|at the contract path)$/;

export function a11y(trial: Trial): GraderResult {
  const report = readReport<RuntimeReport>(trial, "runtime-report.json");
  if (!report) {
    return notApplicable(
      "a11y",
      "runtime",
      "no runtime report — validation did not reach the reporting step",
    );
  }

  if (!report.rendered) {
    // Nothing to render is `component-contract`'s finding, not this grader's.
    // Scoring it here as well double-counts a single mistake — which is exactly
    // what happened on `2026-08-07T06-22-20.098Z`, where a component named
    // `badge.tsx` was reported as "no component" and took a11y to 0.00.
    if (NOTHING_TO_RENDER.test(report.reason ?? "")) {
      return notApplicable(
        "a11y",
        "runtime",
        report.reason ?? "nothing to render",
      );
    }

    return result("a11y", "runtime", [
      check(
        "renders",
        "the component renders",
        false,
        report.reason ?? "render produced no output",
      ),
      check(
        "no-blocking-violations",
        "no critical or serious axe violations",
        false,
      ),
    ]);
  }

  const blocking = report.violations.filter((violation) =>
    BLOCKING_IMPACTS.has(violation.impact ?? ""),
  );
  const minor = report.violations.length - blocking.length;

  return result("a11y", "runtime", [
    check("renders", "the component renders", true),
    check(
      "no-blocking-violations",
      "no critical or serious axe violations",
      blocking.length === 0,
      blocking.length
        ? blocking.map((v) => `${v.id} (${v.impact}, ×${v.nodes})`).join(", ")
        : undefined,
    ),
    partial(
      "no-minor-violations",
      "no moderate or minor axe violations",
      minor === 0 ? 1 : Math.max(0, 1 - minor * 0.25),
      minor ? `${minor} non-blocking violation(s)` : undefined,
    ),
  ]);
}

function firstLines(detail: string, count = 4): string {
  return detail.split("\n").filter(Boolean).slice(0, count).join(" / ");
}
