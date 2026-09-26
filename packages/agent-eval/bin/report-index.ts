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
 * Arms are grouped into cohorts — one model at one profile — and every delta is
 * taken against that cohort's own `none` arm. A single global baseline made the
 * page unreadable in two ways at once: it charged the model difference to the
 * MCP servers (sonnet arms billed 11.6× the cost of a haiku baseline, of which
 * almost none was the servers), and it forced every cohort onto one matrix,
 * where the 5-task sonnet subset and the 3-task paste subset left four-fifths
 * of the grid empty. `--baseline` is now only a fallback, used for a cohort
 * that has no `none` arm of its own.
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

/** Fallback baseline, for a cohort with no `none` arm of its own. */
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

type TaskIndex = Map<
  string,
  Map<string, { summary: Aggregate; cells: Cell[] }>
>;

/**
 * Arm names are `cc-{variant}-{model}-{profile}`, so
 * `cc-design-tokens-haiku-high` is the design-tokens variant on haiku at the
 * high reasoning profile.
 */
interface Arm {
  name: string;
  variant: string;
  /** `{model}-{context}` — the set of arms that are comparable to each other. */
  cohort: string;
}

function parseArm(name: string): Arm {
  const parts = name.split("-");
  if (parts.length < 4) return { name, variant: name, cohort: "other" };

  return {
    name,
    variant: parts.slice(1, -2).join("-"),
    cohort: `${parts[parts.length - 2]}-${parts[parts.length - 1]}`,
  };
}

/**
 * Notes for a cohort's context segment, where it needs one.
 *
 * The trailing segment of an arm name is not one axis. On `-high` arms it is
 * the reasoning effort; on `-paste` arms it is the fixture tier, and those arms
 * also run at `effort: "high"`. Grouping on it is still right — it separates
 * exactly the things that must not be pooled — but a reader comparing a 0.95
 * here against a 0.83 there deserves to be told they are different fixtures.
 */
const CONTEXT_NOTES: Record<string, string> = {
  paste:
    "fixture ships no <code>src/token/</code> — the pasted-snippet context of " +
    "D-159, where there is nothing to grep. Absolute scores are not comparable " +
    "to the repo cohorts above; only the within-cohort Δ is.",
};

/**
 * A cohort is one model in one context — the only grouping inside which a delta
 * means "the MCP servers did this".
 *
 * A single global baseline forces comparisons across both axes at once.
 * `cc-both-sonnet-high` against a haiku baseline adds the model difference to
 * the server difference and prints the sum as the server's effect; the paste
 * arms against a repo baseline would add the fixture difference on top of that,
 * pooling the one context where the design-tokens server has a measured outcome
 * effect (D-160) into nineteen where it does not. Sonnet also runs a 5-task
 * subset where haiku runs 20, and paste runs 3, so on one shared matrix those
 * columns were mostly empty. Grouping fixes all of it — each cohort carries its
 * own `none` baseline, and its matrix only carries the tasks it actually ran.
 */
interface Cohort {
  id: string;
  arms: Arm[];
  /** The cohort's own `none` arm, where it has one. */
  baseline: string | null;
  tasks: string[];
}

function buildCohorts(
  armNames: Iterable<string>,
  tasks: TaskIndex,
  preferred: string,
): Cohort[] {
  const grouped = new Map<string, Arm[]>();
  for (const name of armNames) {
    const arm = parseArm(name);
    const list = grouped.get(arm.cohort) ?? [];
    list.push(arm);
    grouped.set(arm.cohort, list);
  }

  const cohorts = [...grouped.entries()].map(([id, arms]): Cohort => {
    arms.sort((a, b) =>
      a.variant === "none"
        ? -1
        : b.variant === "none"
          ? 1
          : a.variant.localeCompare(b.variant),
    );

    const names = arms.map((arm) => arm.name);

    return {
      id,
      arms,
      baseline:
        arms.find((arm) => arm.variant === "none")?.name ??
        (names.includes(preferred) ? preferred : null),
      tasks: [...tasks.entries()]
        .filter(([, byArm]) => names.some((name) => byArm.has(name)))
        .map(([evalName]) => evalName)
        .sort(),
    };
  });

  // Densest first. The cohort with the most tasks is the campaign; the rest are
  // side comparisons and should not be the first thing on the page.
  return cohorts.sort(
    (a, b) =>
      b.tasks.length - a.tasks.length ||
      b.arms.length - a.arms.length ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Mean of the per-task quality deltas, over the tasks *both* arms ran.
 *
 * This is deliberately not `mean(arm) − mean(baseline)`. Arms do not all cover
 * the same task list, and the tasks differ enormously in difficulty, so an
 * unpaired difference of means partly measures which tasks an arm happens to
 * have. Pairing per task removes that, and it makes this number the column mean
 * of the matrix below rather than a second, quietly different figure.
 */
function pairedQualityDelta(
  arm: string,
  baselineArm: string,
  tasks: TaskIndex,
): { mean: number; shared: number } | null {
  const deltas: number[] = [];

  for (const byArm of tasks.values()) {
    const candidate = byArm.get(arm)?.summary;
    const baseline = byArm.get(baselineArm)?.summary;
    if (candidate && baseline) {
      deltas.push(candidate.meanQuality - baseline.meanQuality);
    }
  }

  if (!deltas.length) return null;
  return {
    mean: deltas.reduce((a, b) => a + b, 0) / deltas.length,
    shared: deltas.length,
  };
}

/**
 * Quality points at which the colour saturates. Real arm-versus-baseline
 * movement on a 0–1 score sits in the ±0.05–0.20 band; scaling the tint to a
 * full point would render the entire matrix a uniform pale wash and show
 * nothing.
 */
const DELTA_FULL_SCALE = 0.25;

/** A matrix cell: signed delta, tinted green for a gain and red for a loss. */
function deltaCell(value: number): string {
  if (Math.abs(value) < 0.005) {
    return `<td class="ix-delta ix-delta--flat">0.00</td>`;
  }

  const weight = Math.min(Math.abs(value) / DELTA_FULL_SCALE, 1);
  const alpha = (0.1 + weight * 0.5).toFixed(3);
  const rgb = value > 0 ? "5,150,105" : "220,38,38";

  return `<td class="ix-delta" style="background:rgba(${rgb},${alpha})">${signed(
    value,
  )}</td>`;
}

/** Campaign-level table: one row per arm, grouped into cohorts. */
function overviewSection(
  overall: Map<string, Aggregate>,
  tasks: TaskIndex,
  cohorts: Cohort[],
): string {
  const taskCount = (arm: string): number =>
    [...tasks.values()].filter((byArm) => byArm.has(arm)).length;

  const body = cohorts
    .map((cohort) => {
      const base = cohort.baseline ? overall.get(cohort.baseline) : null;
      const note = CONTEXT_NOTES[cohort.id.split("-").pop() ?? ""];

      const rows = cohort.arms
        .map(({ name, variant }) => {
          const summary = overall.get(name);
          if (!summary) return "";

          const isBaseline = name === cohort.baseline;
          const paired =
            isBaseline || !cohort.baseline
              ? null
              : pairedQualityDelta(name, cohort.baseline, tasks);
          const costRatio =
            base && base.meanCostUsd > 0
              ? summary.meanCostUsd / base.meanCostUsd
              : null;

          return `
        <tr${isBaseline ? ' class="ix-baseline-row"' : ""}>
          <th scope="row">${escape(variant)}${
            isBaseline ? ' <span class="ix-note">baseline</span>' : ""
          }</th>
          <td>${taskCount(name)}</td>
          <td>${summary.counted + summary.excluded}</td>
          <td>${summary.meanQuality.toFixed(2)}</td>
          <td>${paired ? signed(paired.mean) : "—"}</td>
          <td>${pct(summary.passAt1)}</td>
          <td>${usd(summary.meanCostUsd)}</td>
          <td>${costRatio === null ? "—" : `${costRatio.toFixed(2)}×`}</td>
          <td>${usd(summary.spentUsd)}</td>
        </tr>`;
        })
        .join("");

      return `
      <tbody>
        <tr class="ix-cohort">
          <th scope="rowgroup" colspan="9">${escape(cohort.id)}
            <span class="ix-note">${cohort.arms.length} arms · ${
              cohort.tasks.length
            } tasks</span>${
              note ? `<span class="ix-context">${note}</span>` : ""
            }
          </th>
        </tr>${rows}
      </tbody>`;
    })
    .join("");

  return `
  <section class="ix-overview">
    <h2 id="overview">overview</h2>
    <table>
      <thead>
        <tr>
          <th scope="col">variant</th>
          <th scope="col">tasks</th>
          <th scope="col">trials</th>
          <th scope="col">quality</th>
          <th scope="col">Δ</th>
          <th scope="col">pass@1</th>
          <th scope="col">$/trial</th>
          <th scope="col">cost ×</th>
          <th scope="col">spend</th>
        </tr>
      </thead>${body}
    </table>
    <p class="ix-caption">
      Rows are grouped by cohort — one model in one context. Δ and cost × are
      against that cohort's own <code>none</code> arm, never across cohorts, so
      a delta here is the servers' effect and not the model's or the fixture's.
      Δ is the mean of the per-task deltas, paired over the tasks both arms ran,
      so it is not the difference of the two quality columns whenever coverage
      differs.
    </p>
  </section>`;
}

/**
 * Cohorts whose absolute scores mean the same thing — same fixtures, so a
 * difference between two of them is the model or the reasoning effort rather
 * than the task. `CONTEXT_NOTES` marks the contexts where that stops holding
 * (`paste` ships no `src/token/`), and those are held out rather than pooled.
 */
function comparableCohorts(cohorts: Cohort[]): Cohort[] {
  return cohorts.filter(
    (cohort) => !CONTEXT_NOTES[cohort.id.split("-").pop() ?? ""],
  );
}

/**
 * The tasks every one of these cohorts ran.
 *
 * Comparing models is the one thing this report has to do across cohorts, and
 * coverage differs — Sonnet ran a five-task subset where Haiku ran twenty.
 * Averaging each cohort over its own list would set Sonnet's mean of five
 * against Haiku's of twenty and print the difference as a model difference,
 * when a good part of it is which tasks each happened to draw. The intersection
 * is the only set on which these columns answer the same question, and it is
 * small enough to be worth printing next to the numbers it produced.
 */
function sharedTasks(cohorts: Cohort[]): string[] {
  if (!cohorts.length) return [];
  return cohorts
    .reduce<
      string[]
    >((shared, cohort) => shared.filter((task) => cohort.tasks.includes(task)), [...(cohorts[0]?.tasks ?? [])])
    .sort();
}

/**
 * Per-task mean of one field for one arm, over a fixed task list.
 *
 * Unweighted by trial, matching `pairedQualityDelta`: a task is one
 * observation whether it ran three times or five, so a cohort does not move
 * the comparison by running more repeats of the same fixture.
 */
function meanOverTasks(
  arm: string | null,
  taskNames: string[],
  tasks: TaskIndex,
  pick: (summary: Aggregate) => number,
): number | null {
  if (!arm) return null;

  const values = taskNames
    .map((name) => tasks.get(name)?.get(arm)?.summary)
    .filter((summary): summary is Aggregate => Boolean(summary))
    .map(pick);

  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Model × server matrix — the cross-cohort view the per-cohort tables refuse
 * to give.
 *
 * Everything else on this page is scoped to one cohort on purpose, because a
 * delta that spans models measures the model and the servers at once and the
 * servers are what the campaign is about. This section asks the other
 * question — what does each model, at each reasoning effort, cost and deliver —
 * and the honest way to ask it is on the shared task set with the server effect
 * broken out as its own column rather than folded into the score.
 *
 * The column worth reading is Δ, not the absolute quality: if a cheap model's
 * Δ is larger than an expensive one's, the servers are substituting for model
 * capability, which is the campaign's actual hypothesis.
 */
function cohortSection(tasks: TaskIndex, cohorts: Cohort[]): string {
  const comparable = comparableCohorts(cohorts);
  if (comparable.length < 2) return "";

  const shared = sharedTasks(comparable);
  const held = cohorts.length - comparable.length;

  if (!shared.length) {
    return `
  <section class="ix-cohorts">
    <h2 id="cohorts">models compared</h2>
    <p class="ix-caption">
      ${comparable.length} comparable cohorts, but no single task was run by all
      of them, so there is no set on which their scores answer the same
      question. This table fills in once one task is shared across every cohort.
    </p>
  </section>`;
  }

  const variants = [
    ...new Set(
      comparable.flatMap((cohort) => cohort.arms.map((a) => a.variant)),
    ),
  ].sort((a, b) => (a === "none" ? -1 : b === "none" ? 1 : a.localeCompare(b)));

  const armFor = (cohort: Cohort, variant: string): string | null =>
    cohort.arms.find((arm) => arm.variant === variant)?.name ?? null;

  const measured = comparable
    .map((cohort) => {
      const scores = new Map<string, number>();
      for (const variant of variants) {
        const value = meanOverTasks(
          armFor(cohort, variant),
          shared,
          tasks,
          (s) => s.meanQuality,
        );
        if (value !== null) scores.set(variant, value);
      }
      return { cohort, scores };
    })
    .filter(({ scores }) => scores.size > 0)
    // Strongest baseline first, so the rows read as a capability ladder and the
    // Δ column can be scanned against it.
    .sort((a, b) => (b.scores.get("none") ?? 0) - (a.scores.get("none") ?? 0));

  const rows = measured
    .map(({ cohort, scores }) => {
      const top = Math.max(...scores.values());
      const none = scores.get("none") ?? null;

      const best =
        [...scores.entries()]
          .filter(([variant]) => variant !== "none")
          .sort((a, b) => b[1] - a[1])[0] ?? null;

      const bestArm = best ? armFor(cohort, best[0]) : null;
      const noneArm = armFor(cohort, "none");

      const bestCost = meanOverTasks(
        bestArm,
        shared,
        tasks,
        (s) => s.meanCostUsd,
      );
      const noneCost = meanOverTasks(
        noneArm,
        shared,
        tasks,
        (s) => s.meanCostUsd,
      );
      const bestTime = meanOverTasks(
        bestArm,
        shared,
        tasks,
        (s) => s.meanDurationSeconds,
      );
      const bestPass = meanOverTasks(bestArm, shared, tasks, (s) => s.passAt1);

      const cells = variants
        .map((variant) => {
          const value = scores.get(variant);
          if (value === undefined) {
            return `<td class="ix-na" title="not run">—</td>`;
          }
          const text = value.toFixed(2);
          return `<td>${value === top ? `<strong>${text}</strong>` : text}</td>`;
        })
        .join("");

      return `
        <tr>
          <th scope="row"><a href="#matrix-${escape(cohort.id)}">${escape(
            cohort.id,
          )}</a></th>${cells}
          <td>${best ? escape(best[0]) : "—"}</td>
          ${
            best && none !== null
              ? deltaCell(best[1] - none)
              : `<td class="ix-na">—</td>`
          }
          <td>${bestPass === null ? "—" : pct(bestPass)}</td>
          <td>${noneCost === null ? "—" : usd(noneCost)}</td>
          <td>${bestCost === null ? "—" : usd(bestCost)}</td>
          <td>${bestTime === null ? "—" : `${Math.round(bestTime)}s`}</td>
        </tr>`;
    })
    .join("");

  const head = variants
    .map((variant) => `<th scope="col">${escape(variant)}</th>`)
    .join("");

  return `
  <section class="ix-cohorts">
    <h2 id="cohorts">models compared</h2>
    <div class="ix-scroll">
      <table class="ix-matrix">
        <thead>
          <tr>
            <th scope="col">cohort</th>${head}
            <th scope="col">best</th>
            <th scope="col">Δ</th>
            <th scope="col">pass@1</th>
            <th scope="col">$/trial none</th>
            <th scope="col">$/trial best</th>
            <th scope="col">s/trial</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="ix-caption">
      Every figure is the mean over the ${shared.length} task${
        shared.length === 1 ? "" : "s"
      } run by all ${measured.length} cohorts, unweighted by trial count, so
      the columns answer the same question for each row even where total
      coverage differs. Quality columns are absolute; <strong>bold</strong>
      marks the best variant in a row. Δ is that variant's quality minus the
      cohort's own <code>none</code> arm — the servers' contribution at that
      model and effort, and the only cell here that is a controlled comparison.
      A larger Δ on a weaker baseline is the servers substituting for model
      capability.${
        held
          ? ` ${held} cohort${held === 1 ? " is" : "s are"} held out for running
      a different fixture set; see the note on ${escape(
        Object.keys(CONTEXT_NOTES).join(", "),
      )} above.`
          : ""
      }
    </p>
  </section>`;
}

/** One cohort's task × variant matrix. Dense by construction. */
function matrixTable(tasks: TaskIndex, cohort: Cohort): string {
  const names = cohort.arms.map((arm) => arm.name);

  const head = cohort.arms
    .map(
      ({ name, variant }) =>
        `<th scope="col"><span>${escape(variant)}</span>${
          name === cohort.baseline
            ? '<br><span class="ix-note">baseline</span>'
            : ""
        }</th>`,
    )
    .join("");

  const rows = cohort.tasks
    .map((evalName) => {
      const byArm = tasks.get(evalName)!;
      const baseline = cohort.baseline
        ? (byArm.get(cohort.baseline)?.summary ?? null)
        : null;

      const cells = names
        .map((name) => {
          const summary = byArm.get(name)?.summary;
          if (!summary) return `<td class="ix-na" title="not run">—</td>`;
          if (name === cohort.baseline) {
            return `<td class="ix-base" title="baseline quality">${summary.meanQuality.toFixed(
              2,
            )}</td>`;
          }
          // A cohort without a `none` arm, or a task its baseline skipped, has
          // no delta to show. The score is still the only measurement anyone
          // has for it, so the cell carries that rather than going blank.
          if (!baseline) {
            return `<td class="ix-abs" title="no baseline for this task — absolute quality">${summary.meanQuality.toFixed(
              2,
            )}</td>`;
          }
          return deltaCell(summary.meanQuality - baseline.meanQuality);
        })
        .join("");

      return `
        <tr>
          <th scope="row"><a href="#${escape(evalName)}">${escape(
            evalName,
          )}</a></th>${cells}
        </tr>`;
    })
    .join("");

  const footer = names
    .map((name) => {
      if (name === cohort.baseline) return `<td class="ix-base">—</td>`;
      const paired = cohort.baseline
        ? pairedQualityDelta(name, cohort.baseline, tasks)
        : null;
      return paired ? deltaCell(paired.mean) : `<td class="ix-na">—</td>`;
    })
    .join("");

  return `
    <h3 id="matrix-${escape(cohort.id)}">${escape(cohort.id)}
      <span class="ix-note">${cohort.tasks.length} tasks · ${
        cohort.arms.length
      } arms</span>
    </h3>${
      CONTEXT_NOTES[cohort.id.split("-").pop() ?? ""]
        ? `<p class="ix-caption ix-context">${
            CONTEXT_NOTES[cohort.id.split("-").pop() ?? ""]
          }</p>`
        : ""
    }
    <div class="ix-scroll">
      <table class="ix-matrix">
        <thead><tr><th scope="col">task</th>${head}</tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th scope="row">mean Δ</th>${footer}</tr></tfoot>
      </table>
    </div>`;
}

/** Task × variant quality deltas, one matrix per cohort. */
function matrixSection(tasks: TaskIndex, cohorts: Cohort[]): string {
  return `
  <section class="ix-matrix-wrap">
    <h2 id="matrix">quality deltas by task</h2>
    ${cohorts.map((cohort) => matrixTable(tasks, cohort)).join("")}
    <p class="ix-caption">
      One matrix per cohort, so every column is the same model in the same
      context and every row is a task that cohort ran. The baseline column
      carries absolute quality; every other cell is that variant's quality on
      that task minus the baseline's. Tint saturates at
      ±${DELTA_FULL_SCALE.toFixed(2)}. Cells in <i>italics</i> are absolute
      quality where no baseline exists to subtract. Task names link to the run
      below.
    </p>
  </section>`;
}

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
  cohorts: Cohort[],
): string {
  // Grouped and baselined exactly like the matrix above: a Δ in this table is
  // within one model at one profile, never across them.
  const body = cohorts
    .map((cohort) => {
      const present = cohort.arms.filter((arm) => perArm.has(arm.name));
      if (!present.length) return "";

      const baseline = cohort.baseline
        ? (perArm.get(cohort.baseline)?.summary ?? null)
        : null;

      const rows = present
        .map((arm) => {
          const { summary, cells } = perArm.get(arm.name)!;
          return armRow(arm.variant, summary, baseline, cells);
        })
        .join("");

      return `
      <tbody>
        <tr class="ix-cohort">
          <th scope="rowgroup" colspan="8">${escape(cohort.id)}</th>
        </tr>${rows}
      </tbody>`;
    })
    .join("");

  return `
  <section class="ix-task">
    <h2 id="${escape(evalName)}">${escape(evalName)}</h2>
    <table>
      <thead>
        <tr>
          <th scope="col">variant</th>
          <th scope="col">quality</th>
          <th scope="col">Δ</th>
          <th scope="col">pass@1</th>
          <th scope="col">$/trial</th>
          <th scope="col">cost ×</th>
          <th scope="col">quality/extra $</th>
          <th scope="col">runs</th>
        </tr>
      </thead>${body}
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
  h2 {
    font-size: 1.1rem; margin: 2.5rem 0 .5rem;
    font-family: ui-monospace, monospace; scroll-margin-top: 1rem;
  }
  h3 {
    font-size: .95rem; margin: 1.6rem 0 .4rem;
    font-family: ui-monospace, monospace; scroll-margin-top: 1rem;
  }
  .ix-cohort th {
    text-align: left; font-family: ui-monospace, monospace; font-size: .8rem;
    padding-top: 1.1rem; border-bottom: 1px solid rgba(128,128,128,.45);
  }
  tbody:first-of-type .ix-cohort th { padding-top: .3rem; }
  .ix-context {
    display: block; margin: .25rem 0 0; max-width: 58rem;
    font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 400;
    font-size: .78rem; opacity: .75;
  }
  .ix-lede { margin: 0 0 2rem; opacity: .7; max-width: 46rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: .5rem .6rem; text-align: right; border-bottom: 1px solid rgba(128,128,128,.25); }
  thead th { font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; opacity: .6; }
  tbody th { text-align: left; font-family: ui-monospace, monospace; font-weight: 500; }
  small { opacity: .55; }
  .ix-note { font-size: .68rem; opacity: .55; font-family: ui-sans-serif, sans-serif; text-transform: none; letter-spacing: 0; }
  .ix-caption { font-size: .78rem; opacity: .6; max-width: 46rem; margin: .6rem 0 0; }
  .ix-baseline-row { background: rgba(128,128,128,.08); }

  /* The matrix is the one table that can outgrow the page: a column per arm. */
  .ix-scroll { overflow-x: auto; }
  .ix-matrix { font-variant-numeric: tabular-nums; }
  .ix-matrix thead th { font-size: .68rem; text-transform: none; letter-spacing: 0; vertical-align: bottom; }
  .ix-matrix thead th span { font-family: ui-monospace, monospace; }
  .ix-matrix tbody th { font-size: .82rem; white-space: nowrap; }
  .ix-matrix tbody th a { color: inherit; text-decoration: none; border-bottom: 1px dotted rgba(128,128,128,.6); }
  .ix-matrix tbody th a:hover { border-bottom-style: solid; }
  .ix-matrix tfoot th, .ix-matrix tfoot td { border-top: 2px solid rgba(128,128,128,.35); font-weight: 600; }
  .ix-matrix tfoot th { font-family: ui-sans-serif, sans-serif; font-size: .78rem; }
  .ix-delta { font-size: .82rem; }
  .ix-delta--flat { opacity: .45; }
  .ix-base { font-size: .82rem; opacity: .75; background: rgba(128,128,128,.09); }
  .ix-abs { font-size: .82rem; opacity: .6; font-style: italic; }
  .ix-na { opacity: .3; }
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
  const tasks: TaskIndex = new Map();
  // arm → every counted outcome across every task, for the campaign overview.
  const outcomesByArm = new Map<string, Outcome[]>();

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

      const collected = outcomesByArm.get(experiment) ?? [];
      collected.push(...cells.map((cell) => cell.outcome));
      outcomesByArm.set(experiment, collected);

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

  // Re-aggregating the pooled outcomes rather than averaging the per-task
  // aggregates keeps the exclusion and validity rules of `aggregate` in force
  // at campaign level, and weights by trial rather than by task.
  const overall = new Map<string, Aggregate>();
  for (const [arm, outcomes] of outcomesByArm) {
    const summary = aggregate(outcomes);
    if (summary) overall.set(arm, summary);
  }

  const cohorts = buildCohorts(overall.keys(), tasks, baselineArm);

  const sections = [...tasks.keys()]
    .sort()
    .map((evalName) => taskSection(evalName, tasks.get(evalName)!, cohorts))
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
  ${overall.size} arms in ${cohorts.length} cohorts over ${
    tasks.size
  } tasks — ${trials} trials, ${usd(spend)} spent, ${built} with a built report.
  Every delta is against its own cohort's <code>none</code> arm, so it measures
  the servers and not the model. A thumbnail is the component that trial
  actually produced; click it for the full report.
  Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.
</p>
${overviewSection(overall, tasks, cohorts)}
${cohortSection(tasks, cohorts)}
${matrixSection(tasks, cohorts)}
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
