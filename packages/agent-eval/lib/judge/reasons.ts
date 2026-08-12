/**
 * The recurring diagnoses, as a pick list.
 *
 * Every entry here was read off the notes written during the first ten labels
 * (`calibration/labels.json`) rather than invented from the rubrics — this is a
 * transcription of what a human actually kept saying, which is the only thing
 * that makes a pick list faster than typing. The tally at the time of writing,
 * across the eight `fail` notes:
 *
 *   schema-types          4   "doesn't use JSON Schema for TypeScript interface
 *                              generation" — the single most repeated phrase
 *   tokens-inline         3   "declares component tokens inline in component
 *                              scss file, not in dedicated tokens file"
 *   invented-tokens       2   "--ks-space-2xs", "invented semantic dsa token"
 *   no-component-tokens   2   "doesn't use component tokens"
 *   react-behaviour       2   "shouldn't use React state", "useEffect for
 *                              initialization"
 *   identifier-inline     2   "component identifier defined inline not imported
 *                              from client bundle"
 *   wrong-prefix          2   ".c-badge instead of .dsa-badge"
 *   hardcoded-fallbacks   1   "hard-coded fallback values in variable
 *                              declarations"
 *   wrong-filename        1   "should be BadgeComponent.tsx, not badge.tsx"
 *
 * Re-read at 38 labels, which is the first time the list could be checked
 * against itself rather than against the notes it was transcribed from. Every
 * original entry earned its place — the least-used was picked twice — so
 * nothing is removed here. Picks, and the order the list is now in:
 *
 *   schema-types          7
 *   react-behaviour       7
 *   identifier-inline     5
 *   wrong-filename        5
 *   tokens-inline         4
 *   invented-tokens       3
 *   no-component-tokens   2
 *   hardcoded-fallbacks   2
 *   wrong-prefix          2
 *
 * Ordering by observed use is the one change that costs nothing: the number a
 * grader types is positional and never stored, and `id` exists precisely so
 * that a reordered diff stays readable. Only `label` is written into a note.
 *
 * Editing an entry used to cost as much as deleting one: the sentence went into
 * the note as a copy, so rewording stranded every note that had already used
 * it, and the entry then read as unused the next time this tally was taken. A
 * list transcribed from what people say is a list that will be rephrased, and a
 * store that punishes rephrasing quietly freezes the first draft.
 *
 * So a label now stores `reasons: ["schema-types"]` and the sentence lives in
 * `calibration/reasons.json`, resolved on the way out. Rewording is a text edit
 * with no migration, and the tally above stays honest across it. `id` is the
 * thing that must not change — it is the only part now written to disk.
 *
 * The four additions are the free text people kept typing *alongside* their
 * picks, which is the same evidence that produced the original list:
 *
 *   no-defaults           3   "not using generated defaults and / or
 *                              deepmMergeDefaults on those", "no use of
 *                              defaults, no use of deepMergeDefaults", "it
 *                              would have been nice to use deepMergeDefaults
 *                              from our helpers"
 *   inline-classnames     2   "should use classNames library, not its own cx
 *                              implementation"
 *   callback-props        1   "onAction would typically not be used in our
 *                              types of static component definitions"
 *   wrong-token-prefix    1   "uses invented ksd prefix for token variables"
 *
 * The last two are single sightings, which is the bar `wrong-filename` and
 * `hardcoded-fallbacks` cleared when this file was written; both name a rule
 * the design system actually holds, and an unpicked entry costs one line of
 * scanning.
 *
 * Not added: SCSS flatness, despite `bem-nesting` now grading it (D-122b). In
 * 38 labels nobody has once complained about it — including on the `812`
 * pairs, where a stylesheet is the entire material. That is evidence it is not
 * a thing this grader says, and an entry invented from a rubric rather than
 * transcribed from a note is exactly what the paragraph above warns against.
 * If it starts appearing in free text it has earned a line.
 *
 * Two properties are deliberate.
 *
 * **The list is scoped to the rubric being asked.** It was not, and that was a
 * mistake this file argued for. The original note read: the diagnoses "do not
 * respect the rubric boundary" — the schema-types complaint appears under
 * `design-intent` and `code-idiom`, the token-file complaint under
 * `design-intent` and `token-reasoning` — and concluded that filtering would
 * hide the option the grader wanted about half the time it came up.
 *
 * The observation was right and the conclusion inverted it. Auditing all 23
 * addressable labels against the criterion each was filed under: `code-idiom`
 * 6/6 of its written reasons on topic, `token-reasoning` 3/3, and
 * `design-intent` **0 of 7** — every one of them a code-idiom observation
 * (file naming, generated prop types, `classnames`, `deepMergeDefaults`, React
 * state). The grader was not reaching across the boundary for a diagnosis they
 * needed; they were answering the wrong question, and an unscoped list handed
 * them the vocabulary to do it fluently. Worse, the list was transcribed from
 * those notes — so the contamination fed itself: off-rubric notes became
 * options, options made off-rubric notes easier to write.
 *
 * Hence `rubrics` below. Note what it exposed: `design-intent` had exactly one
 * entry, because in 38 labels nobody had yet written a design-intent
 * observation — markup structure, how variants and states are expressed,
 * whether a reviewer would recognise the file as one of these. That gap was the
 * finding, and it was left visible rather than filled by invention.
 *
 * It has since been filled, from the judge's notes rather than a rater's. Seven
 * entries were added once the rubric's own reasoning came back in its own
 * vocabulary — composition, Context/Provider, forwardRef, closed variants,
 * where behaviour lives (D-136). The rule that produced them is unchanged:
 * transcribed from something someone actually wrote, not derived from a
 * criterion.
 *
 * **No entry may be tagged both `design-intent` and `code-idiom`.** Those two
 * rubrics differ by what it costs to be wrong, not by subject, so a diagnosis
 * belongs to exactly one of them: if it is fixed by moving a file or a
 * find-and-replace it is code-idiom's, and if it needs the component rewritten
 * it is design-intent's. Nothing is both. `react-behaviour` was tagged for both
 * and is now design-intent's alone — React state where a client bundle belongs
 * is not something you rename your way out of. Tags that span *other* pairs
 * stay: `schema-types` is code-idiom and `api-design`, `styling-props` is
 * design-intent and `api-design`, and those are different axes rather than two
 * points on one (D-135 amendment).
 *
 * `api-design` tags exist but are never shown — the rubric is ungated and its
 * `requires: ["schema"]` is unmet across the suite. `callback-props` was picked
 * once, necessarily under a rubric that was not asking about the API.
 *
 * **No label contains a comma.** Notes are still free text and still joined
 * with ", " when several people have written on one pair, so a comma inside a
 * sentence that gets rendered beside them would make the line ambiguous to read
 * back — and these lines are read back, by hand, off the `--report`
 * disagreement list.
 *
 * Adding to this list is expected and cheap. It changes nothing already stored:
 * notes are free text, and labels are keyed by rubric and material hash.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface Reason {
  /** Stable, and now the only part written to a label. Never reword an id. */
  id: string;
  /** Shown, never stored. Reword freely. Must not contain a comma. */
  label: string;
  /**
   * The rubrics this diagnosis is an answer to.
   *
   * A grader offered a diagnosis the question does not ask about will use it,
   * and the verdict then measures the wrong rubric — which is what happened to
   * every `design-intent` label collected before this field existed.
   */
  rubrics: string[];
}

/**
 * The dictionary, as data rather than code.
 *
 * In `calibration/` and not `lib/` for two reasons. It is the same directory
 * the labels live in, and a label is now unreadable without it — the two want
 * to travel together, into git and into a `labels:pull`. And the deployed image
 * copies `calibration/` while it does not copy `lib/`, so the hosted grader
 * reads this file directly instead of the copy that used to be frozen into
 * `bundle.json`: rewording a sentence is now an edit and a deploy, not an edit
 * and a re-export.
 */
export const REASONS: Reason[] = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../calibration/reasons.json", import.meta.url)),
    "utf8",
  ),
) as Reason[];

const BY_ID = new Map(REASONS.map((reason) => [reason.id, reason]));

/**
 * Ids to sentences, for anything a person reads.
 *
 * An id with no entry is passed through as itself rather than dropped: a
 * deleted entry leaves labels behind, and `schema-types` on a report line is a
 * worse answer than the sentence but a much better one than silence.
 */
export const describe = (ids: readonly string[]): string[] =>
  ids.map((id) => BY_ID.get(id)?.label ?? id);

/**
 * Two `rubrics` tags that look like hedges and are not, recorded here because
 * JSON cannot hold a comment and both were argued for once already.
 *
 * `react-behaviour` is tagged `design-intent` **and** `code-idiom`. How a
 * component expresses state is what design-intent asks about; using the client
 * bundle to do it is the local dialect. It is the one diagnosis that genuinely
 * answers two questions.
 *
 * `tokens-inline` is tagged `code-idiom` only. Where a token is declared is
 * file structure. *Which* token is chosen is `token-reasoning`, and that
 * rubric's criterion says so outright.
 */

/**
 * The diagnoses offered for one rubric, in the order they are numbered.
 *
 * Numbering is per rubric and therefore not stable across rubrics — which is
 * fine, because the number is positional and nothing but the id is stored.
 */
export const reasonsFor = (rubric: string): Reason[] =>
  REASONS.filter((reason) => reason.rubrics.includes(rubric));

/**
 * Resolve a typed selection like `1,3 5` into ids, against the list offered for
 * one rubric.
 *
 * Separator-tolerant on purpose: the cost of rejecting `1 3` because the prompt
 * said commas is a re-typed line every time, in a loop whose entire reason for
 * existing is that human attention is the scarce resource. Out-of-range and
 * non-numeric entries come back in `invalid` so the caller can say so rather
 * than silently dropping a reason the grader believed they had recorded.
 */
export function resolveReasons(
  input: string,
  rubric: string,
): {
  ids: string[];
  invalid: string[];
} {
  const offered = reasonsFor(rubric);
  const ids: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<number>();

  for (const raw of input.split(/[\s,]+/).filter(Boolean)) {
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 1 || index > offered.length) {
      invalid.push(raw);
      continue;
    }
    if (seen.has(index)) continue;
    seen.add(index);
    ids.push(offered[index - 1]!.id);
  }

  return { ids, invalid };
}
