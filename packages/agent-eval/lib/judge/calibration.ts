/**
 * 3.6 / 3.7 — hand-grading, and what it says about the judge.
 *
 * The judge is worth 15% of the composite score once 3.8 lands, and two defects
 * found while building it argue against granting that on trust: `api-design`
 * invented the contents of a schema it had never been shown (D-102), and
 * `code-idiom` faults candidates for files that exist but were withheld
 * (D-103). Neither was visible in the pass/fail totals. Human labels are the
 * only instrument that finds this class of error, because the failure mode is
 * *plausible* reasoning about the wrong thing.
 *
 * Three properties this file exists to guarantee:
 *
 * 1. **Labels outlive results.** `results/` is gitignored, prunable and
 *    rebuilt every campaign; hand-grading is the most expensive artefact in
 *    the project. Labels live in the package and are committed.
 *
 * 2. **Labels survive rubric edits.** A label is keyed by rubric id and a hash
 *    of the material, never by the criterion text. 3.7 iterates the wording
 *    until agreement holds, and if every edit invalidated the grading the loop
 *    would cost twenty hand-gradings per attempt and would simply not be run.
 *    The human answers a question about the code; the criterion is the wording
 *    under test.
 *
 * 3. **The human sees exactly what the judge saw, and not what it concluded.**
 *    Agreement between a human reading the repository and a judge reading four
 *    files would measure the difference in evidence, not in judgement. And a
 *    verdict shown before labelling is an anchor, which is why `nextUnlabelled`
 *    hands back material and criterion only.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { listExperiments, loadEval, resolveMatrix } from "../graders/trial";
import type { Trial } from "../graders/trial";
import { describe } from "./reasons";
import { judgedMaterial, readCache, type Verdict } from "./run";
import { RUBRICS, type Rubric } from "./rubrics";

const LABELS = fileURLToPath(
  new URL("../../calibration/labels.json", import.meta.url),
);

/** One file per rater. See `readRaters`. */
const LABEL_DIR = fileURLToPath(
  new URL("../../calibration/labels", import.meta.url),
);

/**
 * Who is grading. The web app takes this from the JWT subject; the CLI falls
 * back to the OS user, which is right for the single-machine case and wrong
 * the moment two people share a checkout — hence the override.
 */
export const rater = (): string =>
  process.env.CALIBRATION_RATER?.trim() || userInfo().username;

export interface Label {
  /** The same three-way scale the judge answers on. */
  verdict: Verdict;
  /**
   * Ids from `calibration/reasons.json` — not the sentences.
   *
   * Storing the sentence made rewording an entry destructive: the copy in the
   * note went stale, the tally that decides which entries earn their place
   * stopped seeing it, and the list froze at whatever phrasing was typed first.
   * Ids cost one lookup on the way out and make the wording editable forever.
   *
   * Optional because the first labels predate it and keep their prose in
   * `note`. `describeLabel` reads both.
   */
  reasons?: string[];
  /**
   * Free text — whatever the pick list had no entry for.
   *
   * This is where new vocabulary comes from: every entry in the dictionary was
   * transcribed out of this field before it was a pick.
   */
  note: string;
  /** Readable, for review. Not the key — code moves between runs. */
  address: string;
  rubric: string;
  labelledAt: string;
  /**
   * Added with multi-rater support. Absent on the first 38 labels, which
   * predate it — `readRaters` attributes those to the file they live in, so
   * nothing needs backfilling and no key changes.
   */
  rater?: string;
}

/** A label as one line of prose: picked diagnoses first, then the residue. */
export const describeLabel = (label: Label): string =>
  [...describe(label.reasons ?? []), label.note].filter(Boolean).join(", ");

/** A (trial, rubric) pair that can be labelled, with the judge's answer if any. */
export interface Item {
  trial: Trial;
  rubric: Rubric;
  material: string;
  key: string;
  address: string;
  judged: { verdict: Verdict; reason: string } | null;
}

export const materialHash = (material: string): string =>
  createHash("sha256").update(material).digest("hex").slice(0, 16);

/** Rubric id plus material — deliberately not the criterion. See (2) above. */
export const labelKey = (rubric: Rubric, material: string): string =>
  `${rubric.id}:${materialHash(material)}`;

export const address = (trial: Trial): string =>
  `${trial.experiment}/${trial.evalName}/run-${trial.run}`;

/**
 * Every rater's labels, keyed by rater.
 *
 * One file per person, because the alternative — a single map with a rater
 * field — makes two people grading the same session a git conflict on every
 * line, and the whole point of a hosted queue is that they can. Separate files
 * merge by union, which is what a set of independent opinions actually is.
 *
 * `calibration/labels.json` is read as a rater in its own right: the first 38
 * labels were written before this existed, and moving them would rewrite the
 * provenance of the only hand-grading the project has.
 */
export function readRaters(): Record<string, Record<string, Label>> {
  const out: Record<string, Record<string, Label>> = {};

  const load = (path: string, name: string): void => {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      Label
    >;
    if (Object.keys(parsed).length) out[name] = parsed;
  };

  if (existsSync(LABELS)) load(LABELS, legacyRater());

  if (existsSync(LABEL_DIR))
    for (const file of readdirSync(LABEL_DIR).sort())
      if (file.endsWith(".json"))
        load(join(LABEL_DIR, file), file.replace(/\.json$/, ""));

  return out;
}

/**
 * The name the pre-multi-rater labels are filed under.
 *
 * They carry no `rater`, and inventing one would be a claim about who graded
 * them. The OS user is the only evidence available and it is right on the
 * machine they were made on; `CALIBRATION_RATER` overrides it elsewhere.
 */
const legacyRater = (): string =>
  process.env.CALIBRATION_LEGACY_RATER?.trim() || rater();

/**
 * One verdict per key, pooled across raters — the ground truth `agreement`
 * compares the judge against.
 *
 * Modal, the same rule already used to pool a judge's repeated answers on
 * identical material. A tie means the humans genuinely split, and there is no
 * honest way to resolve that here, so the earliest label wins and the split is
 * reported by `raterAgreement` rather than buried. Notes are concatenated:
 * on a disagreement the note is the diagnosis, and dropping half of them
 * discards the reason the pooling was interesting.
 */
export function readLabels(): Record<string, Label> {
  const byKey = new Map<string, Label[]>();

  for (const [name, labels] of Object.entries(readRaters()))
    for (const [key, label] of Object.entries(labels))
      byKey.set(key, [...(byKey.get(key) ?? []), { ...label, rater: name }]);

  const out: Record<string, Label> = {};

  for (const [key, group] of byKey) {
    const ordered = [...group].sort((a, b) =>
      a.labelledAt.localeCompare(b.labelledAt),
    );
    const verdict = modal(ordered.map((label) => label.verdict));
    const winner = ordered.find((label) => label.verdict === verdict)!;

    out[key] =
      ordered.length === 1
        ? winner
        : {
            ...winner,
            // Flattened to prose deliberately: two people's diagnoses of one
            // pair are two opinions, not a set, and pooling the id arrays
            // would lose which of them said what.
            reasons: undefined,
            note: ordered
              .map((label) => [label.rater, describeLabel(label)] as const)
              .filter(([, text]) => text)
              .map(([name, text]) => `${name}: ${text}`)
              .join(" | "),
          };
  }

  return out;
}

export function writeLabel(key: string, label: Label): void {
  const name = label.rater ?? rater();
  const path = join(LABEL_DIR, `${name}.json`);

  const existing = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, Label>)
    : {};

  existing[key] = { ...label, rater: name };
  mkdirSync(LABEL_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify(existing, null, 2)}\n`);
}

/** Every (trial, rubric) pair the judge would currently ask about. */
export function candidates(): Item[] {
  const items: Item[] = [];

  for (const experiment of listExperiments()) {
    for (const entry of resolveMatrix(experiment)) {
      for (const trial of loadEval(
        experiment,
        entry.timestamp,
        entry.evalName,
      )) {
        const cache = readCache(trial.runDir);
        for (const rubric of RUBRICS) {
          const material = judgedMaterial(trial, rubric);
          if (material === null) continue;
          const judged = cache.results[rubric.id];
          items.push({
            trial,
            rubric,
            material,
            key: labelKey(rubric, material),
            address: address(trial),
            judged: judged
              ? { verdict: judged.verdict, reason: judged.reason }
              : null,
          });
        }
      }
    }
  }

  return items;
}

/**
 * Order the queue so that a partial grading is still a fair sample.
 *
 * Twenty labels is the target and there are 180 candidates, so which twenty
 * decides the answer. Taking them in directory order would grade one arm and
 * call it agreement. Instead the pairs are bucketed by (eval, rubric, arm) and
 * drawn round-robin, so stopping at any point leaves the grid evenly covered;
 * within a bucket the order is a hash, which is arbitrary but fixed, so the
 * queue does not reshuffle between sessions.
 *
 * Note what is *not* stratified: the judge's verdict. Sampling failures at a
 * higher rate would measure agreement on the cases the judge found hardest and
 * report it as agreement overall.
 */
export function queue(items: Item[]): Item[] {
  const buckets = new Map<string, Item[]>();

  // One entry per labelled unit. Identical code appears in several trials, and
  // grading it once answers for all of them — without this the session would
  // present the same `860` component four times and record four labels that
  // were always going to be the same.
  const unique = new Map<string, Item>();
  for (const item of items)
    if (!unique.has(item.key)) unique.set(item.key, item);

  for (const item of unique.values()) {
    const bucket = `${item.trial.evalName}|${item.rubric.id}|${item.trial.variant}`;
    const list = buckets.get(bucket) ?? [];
    list.push(item);
    buckets.set(bucket, list);
  }

  const ordered = [...buckets.keys()].sort((a, b) =>
    // Hashed rather than alphabetical: sorting by name draws every bucket of
    // `810` before touching `812`, so a session that stops at twenty labels
    // has graded one task exhaustively and the rest not at all.
    materialHash(a).localeCompare(materialHash(b)),
  );
  for (const key of ordered) {
    buckets.get(key)!.sort((a, b) => a.key.localeCompare(b.key));
  }

  const out: Item[] = [];
  for (let depth = 0; out.length < unique.size; depth += 1) {
    for (const key of ordered) {
      const item = buckets.get(key)![depth];
      if (item) out.push(item);
    }
  }

  return out;
}

export interface Agreement {
  rubric: string;
  n: number;
  agreed: number;
  rate: number;
  kappa: number;
  confusion: Record<string, number>;
  /** Groups of trials whose code is byte-identical, and how many the judge answered the same way. */
  repeated: { groups: number; consistent: number };
  disagreements: Array<{
    address: string;
    human: Verdict;
    judge: Verdict;
    note: string;
    reason: string;
  }>;
}

const VERDICTS: Verdict[] = ["pass", "fail", "unknown"];

const modal = (verdicts: Verdict[]): Verdict => {
  const counts = new Map<Verdict, number>();
  for (const verdict of verdicts)
    counts.set(verdict, (counts.get(verdict) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

/**
 * Raw agreement and Cohen's kappa, per rubric.
 *
 * Both, because raw agreement is the number the PRD sets a threshold on and it
 * is also the number that is easiest to reach for the wrong reason: a rubric
 * that passes everything agrees with a human who also passes most things, at
 * no skill. Kappa is what falls to zero in that case, and near-saturation is a
 * live failure mode here — `design-intent` opened at 48/48.
 *
 * One observation per *labelled unit*, not per trial. Trials frequently share
 * byte-identical code — that is the whole point of `860-restraint`, where the
 * right answer is to change nothing — and since a label is keyed by material,
 * one grading legitimately covers all of them. Counting it once per trial would
 * have turned five hand-gradings into fourteen observations and let a sample of
 * twenty report itself as a sample of a hundred and eighty. Where the judge
 * answered the same material more than once, the majority verdict is used and
 * the disagreements among those answers are reported separately as `repeated`:
 * identical input judged differently is the judge's own noise floor, and it
 * bounds how high agreement could ever go.
 */
export function agreement(
  items: Item[],
  labels: Record<string, Label>,
): Agreement[] {
  return RUBRICS.map((rubric) => {
    const groups = new Map<string, Item[]>();
    for (const item of items) {
      if (item.rubric.id !== rubric.id || !item.judged) continue;
      groups.set(item.key, [...(groups.get(item.key) ?? []), item]);
    }

    const repeated = [...groups.values()].filter((group) => group.length > 1);
    const paired = [...groups.entries()]
      .filter(([key]) => labels[key])
      .map(([key, group]) => ({
        label: labels[key],
        group,
        verdict: modal(group.map((item) => item.judged!.verdict)),
      }));

    const confusion: Record<string, number> = {};
    let agreed = 0;

    for (const { label, verdict } of paired) {
      const cell = `${label.verdict}→${verdict}`;
      confusion[cell] = (confusion[cell] ?? 0) + 1;
      if (label.verdict === verdict) agreed += 1;
    }

    const n = paired.length;
    const rate = n ? agreed / n : 0;

    // Chance agreement from the two marginals, the standard Cohen form.
    let expected = 0;
    for (const verdict of VERDICTS) {
      const human =
        paired.filter((p) => p.label.verdict === verdict).length / (n || 1);
      const judge =
        paired.filter((p) => p.verdict === verdict).length / (n || 1);
      expected += human * judge;
    }
    const kappa = n && expected < 1 ? (rate - expected) / (1 - expected) : 0;

    return {
      rubric: rubric.id,
      n,
      agreed,
      rate,
      kappa,
      confusion,
      repeated: {
        groups: repeated.length,
        consistent: repeated.filter(
          (group) =>
            new Set(group.map((item) => item.judged!.verdict)).size === 1,
        ).length,
      },
      disagreements: paired
        .filter(({ label, verdict }) => label.verdict !== verdict)
        .map(({ label, group, verdict }) => ({
          address:
            group.length > 1
              ? `${group[0].address} (+${group.length - 1} identical)`
              : group[0].address,
          human: label.verdict,
          judge: verdict,
          note: describeLabel(label),
          reason: group[0].judged!.reason,
        })),
    };
  }).filter((result) => result.n > 0);
}

export interface RaterAgreement {
  rubric: string;
  /** Keys carrying a verdict from more than one person. */
  n: number;
  agreed: number;
  rate: number;
  kappa: number;
  splits: Array<{ address: string; verdicts: Record<string, Verdict> }>;
}

/**
 * Human against human — the ceiling on human against judge.
 *
 * 3.7 sets a threshold of 80% agreement between the judge and a human, and
 * with one grader there is no way to read a miss. A disagreement is either the
 * judge being wrong or that particular person being idiosyncratic, and the
 * number cannot tell you which; tuning the rubric against it optimises the
 * judge towards one reviewer's noise and calls the result calibration.
 *
 * Two humans on the same material bound the question. If they agree 75% with
 * each other, an 80% target is not strict, it is unreachable, and the rubric is
 * asking about something the design system has not actually decided. If they
 * agree 95%, a judge at 67% has a real defect and the disagreement list is
 * worth reading line by line.
 *
 * Pairwise over every pair of raters who labelled the same key, rather than
 * against a pooled majority: pooling and then comparing each rater to the pool
 * counts each person partly against themselves and inflates the rate.
 */
export function raterAgreement(
  raters: Record<string, Record<string, Label>>,
): RaterAgreement[] {
  const names = Object.keys(raters).sort();

  return RUBRICS.map((rubric) => {
    const pairs: Array<[Verdict, Verdict]> = [];
    const splits: RaterAgreement["splits"] = [];

    const keys = new Set(
      names.flatMap((name) =>
        Object.entries(raters[name])
          .filter(([, label]) => label.rubric === rubric.id)
          .map(([key]) => key),
      ),
    );

    for (const key of [...keys].sort()) {
      const held = names.filter((name) => raters[name][key]);
      if (held.length < 2) continue;

      for (let a = 0; a < held.length; a += 1)
        for (let b = a + 1; b < held.length; b += 1)
          pairs.push([
            raters[held[a]][key].verdict,
            raters[held[b]][key].verdict,
          ]);

      if (new Set(held.map((name) => raters[name][key].verdict)).size > 1)
        splits.push({
          address: raters[held[0]][key].address,
          verdicts: Object.fromEntries(
            held.map((name) => [name, raters[name][key].verdict]),
          ),
        });
    }

    const n = pairs.length;
    const agreed = pairs.filter(([a, b]) => a === b).length;
    const rate = n ? agreed / n : 0;

    let expected = 0;
    for (const verdict of VERDICTS) {
      const first = pairs.filter(([a]) => a === verdict).length / (n || 1);
      const second = pairs.filter(([, b]) => b === verdict).length / (n || 1);
      expected += first * second;
    }

    return {
      rubric: rubric.id,
      n,
      agreed,
      rate,
      kappa: n && expected < 1 ? (rate - expected) / (1 - expected) : 0,
      splits,
    };
  }).filter((result) => result.n > 0);
}
