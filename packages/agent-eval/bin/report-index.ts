#!/usr/bin/env tsx
/**
 * 2.8 — the results index.
 *
 *   pnpm report:index [--baseline cc-none-sonnet-high]
 *
 * Writes `results/index.html`: every current run, every task, every arm, with
 * headline metrics and baseline deltas, linking to the per-trial Storybooks
 * that `pnpm report build` produces and showing the component each trial
 * actually rendered.
 *
 * It is written *into* `results/` rather than into a separate site directory so
 * that every link is a relative path that already resolves on disk. Publication
 * then uploads one tree, and the same file works locally, in CI and behind the
 * deployed host without a single URL being rewritten.
 *
 * The screenshots are the reason this page is worth having. A table of numbers
 * says `cc-none` scored 0.64 on `810`; a row of sixty thumbnails shows you
 * *what that looked like*, which is the question anyone reviewing a campaign
 * actually opens with.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  listExperiments,
  loadEval,
  resolveMatrix,
  RESULTS_ROOT,
  type Trial,
} from "../lib/graders/trial";
import { collectTrial, type Outcome } from "../lib/report/collect";
import { aggregate, delta, type Aggregate } from "../lib/report/metrics";

const DEFAULT_BASELINE = "cc-none-sonnet-high";

/** Escapes text for HTML. Every value below is machine-generated, but the */
/** transcripts, file names and failure reasons in it are agent-authored. */
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Cell {
  trial: Trial;
  outcome: Outcome;
  /** Relative to `results/`, or null when that artifact was never built. */
  report: string | null;
  shot: string | null;
}

function cellFor(trial: Trial): Cell {
  const asset = (name: string): string | null => {
    const absolute = join(trial.runDir, name);
    return existsSync(absolute)
      ? relative(RESULTS_ROOT, absolute).split(/[\\/]/).join("/")
      : null;
  };

  return {
    trial,
    outcome: collectTrial(trial),
    report: asset(join("storybook-static", "index.html")),
    shot: asset(join("screenshots", "component.png")),
  };
}

const pct = (value: number): string => `${Math.round(value * 100)}%`;
const usd = (value: number): string => `$${value.toFixed(2)}`;
const signed = (value: number, digits = 2): string =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;

/** One arm's row within a task's table. */
function armRow(
  arm: string,
  summary: Aggregate,
  baseline: Aggregate | null,
  cells: Cell[],
): string {
  const change =
    baseline && summary.experiment !== baseline.experiment
      ? delta(summary, baseline)
      : null;

  const thumbnails = cells
    .map((cell) => {
      const label = `run-${cell.trial.run} — ${
        cell.outcome.harnessPassed ? "passed" : "failed"
      }`;
      const image = cell.shot
        ? `<img src="${escape(cell.shot)}" alt="${escape(label)}" loading="lazy">`
        : `<span class="ix-missing">not built</span>`;
      const inner = `<figure class="ix-shot ix-shot--${
        cell.outcome.harnessPassed ? "pass" : "fail"
      }">${image}<figcaption>${escape(label)}</figcaption></figure>`;

      return cell.report
        ? `<a href="${escape(cell.report)}">${inner}</a>`
        : inner;
    })
    .join("");

  return `
    <tr${summary.invalid ? ' class="ix-invalid"' : ""}>
      <th scope="row">${escape(arm)}${
        summary.invalid ? ' <span class="ix-flag">run invalid</span>' : ""
      }</th>
      <td>${summary.meanQuality.toFixed(2)} <small>±${summary.qualityStdDev.toFixed(2)}</small></td>
      <td>${change ? signed(change.quality) : "—"}</td>
      <td>${pct(summary.passAt1)}</td>
      <td>${usd(summary.meanCostUsd)}</td>
      <td>${change ? `${change.costRatio.toFixed(2)}×` : "—"}</td>
      <td>${
        change && Number.isFinite(change.qualityPerExtraDollar)
          ? change.qualityPerExtraDollar.toFixed(3)
          : "—"
      }</td>
      <td class="ix-shots">${thumbnails}</td>
    </tr>`;
}

function taskSection(
  evalName: string,
  perArm: Map<string, { summary: Aggregate; cells: Cell[] }>,
  baselineArm: string,
): string {
  const baseline = perArm.get(baselineArm)?.summary ?? null;

  const rows = [...perArm.entries()]
    .sort(([a], [b]) =>
      a === baselineArm ? -1 : b === baselineArm ? 1 : a.localeCompare(b),
    )
    .map(([arm, { summary, cells }]) => armRow(arm, summary, baseline, cells))
    .join("");

  return `
  <section class="ix-task">
    <h2 id="${escape(evalName)}">${escape(evalName)}</h2>
    <table>
      <thead>
        <tr>
          <th scope="col">arm</th>
          <th scope="col">quality</th>
          <th scope="col">Δ</th>
          <th scope="col">pass@1</th>
          <th scope="col">$/trial</th>
          <th scope="col">cost ×</th>
          <th scope="col">quality/extra $</th>
          <th scope="col">runs</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

const STYLES = `
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; padding: 2rem 1.5rem 6rem; max-width: 78rem;
    font: 15px/1.55 ui-sans-serif, system-ui, sans-serif;
  }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.1rem; margin: 2.5rem 0 .5rem; font-family: ui-monospace, monospace; }
  .ix-lede { margin: 0 0 2rem; opacity: .7; max-width: 46rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: .5rem .6rem; text-align: right; border-bottom: 1px solid rgba(128,128,128,.25); }
  thead th { font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; opacity: .6; }
  tbody th { text-align: left; font-family: ui-monospace, monospace; font-weight: 500; }
  small { opacity: .55; }
  .ix-invalid { background: rgba(220,38,38,.07); }
  .ix-flag { font-size: .7rem; color: #dc2626; font-family: ui-sans-serif, sans-serif; }
  .ix-shots { display: flex; gap: .4rem; justify-content: flex-end; }
  .ix-shots a { text-decoration: none; color: inherit; }
  .ix-shot { margin: 0; width: 9rem; }
  .ix-shot img {
    width: 100%; height: 4rem; object-fit: contain; object-position: center;
    background: #fff; border-radius: 4px; border: 2px solid transparent;
  }
  .ix-shot--pass img { border-color: rgba(5,150,105,.55); }
  .ix-shot--fail img { border-color: rgba(220,38,38,.45); }
  .ix-shot figcaption { font-size: .68rem; opacity: .6; text-align: center; padding-top: .15rem; }
  .ix-missing {
    display: grid; place-items: center; height: 4rem; border-radius: 4px;
    border: 1px dashed rgba(128,128,128,.4); font-size: .7rem; opacity: .5;
  }
`;

function main(): void {
  const argv = process.argv.slice(2);
  const baselineArm =
    argv[argv.indexOf("--baseline") + 1] && argv.includes("--baseline")
      ? argv[argv.indexOf("--baseline") + 1]!
      : DEFAULT_BASELINE;

  // eval → arm → { summary, cells }
  const tasks = new Map<
    string,
    Map<string, { summary: Aggregate; cells: Cell[] }>
  >();

  let trials = 0;
  let spend = 0;

  for (const experiment of listExperiments()) {
    for (const entry of resolveMatrix(experiment)) {
      const cells = loadEval(experiment, entry.timestamp, entry.evalName).map(
        cellFor,
      );
      const summary = aggregate(cells.map((cell) => cell.outcome));
      if (!summary) continue;

      trials += cells.length;
      spend += summary.spentUsd;

      const byArm =
        tasks.get(entry.evalName) ??
        new Map<string, { summary: Aggregate; cells: Cell[] }>();
      byArm.set(experiment, { summary, cells });
      tasks.set(entry.evalName, byArm);
    }
  }

  if (!tasks.size) {
    console.log("No results to index.");
    return;
  }

  const sections = [...tasks.keys()]
    .sort()
    .map((evalName) => taskSection(evalName, tasks.get(evalName)!, baselineArm))
    .join("");

  const built = [...tasks.values()]
    .flatMap((byArm) => [...byArm.values()].flatMap(({ cells }) => cells))
    .filter((cell) => cell.report).length;

  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>agent-eval — results</title>
<style>${STYLES}</style>
<h1>UI generation eval — current results</h1>
<p class="ix-lede">
  ${trials} trials, ${usd(spend)} spent, ${built} with a built report.
  Deltas are against <code>${escape(baselineArm)}</code>. A thumbnail is the
  component that trial actually produced; click it for the full report.
  Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.
</p>
${sections}
</html>
`;

  const destination = join(RESULTS_ROOT, "index.html");
  writeFileSync(destination, html);
  console.log(
    `Wrote ${relative(process.cwd(), destination)} — ${tasks.size} task(s), ${trials} trial(s), ${built} built report(s).`,
  );
}

main();
