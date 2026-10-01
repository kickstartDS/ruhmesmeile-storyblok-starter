/**
 * Typography pairing, graded host-side.
 *
 * `816-typography-pairing` gates on this rule and nothing in the quality
 * composite measured it, so the two runs that differ by one token name — display
 * type coloured with `--ks-text-color-copy` instead of `--ks-text-color-display`
 * — both scored 0.9843 while one failed the task. This grader puts the rule in
 * the composite, where a reader is already looking.
 *
 * The rule itself lives in `lib/typography-pairing.ts`, pinned to the in-sandbox
 * assertion by `bin/graders-selftest.ts`.
 */

import { checkTypographyPairing, PAIRING_ELEMENTS } from "../typography-pairing";
import { check, notApplicable, result, type GraderResult } from "./types";
import { filesIn, readFile, type Trial } from "./trial";

/** The eval this rule belongs to. Its fixture is the only one with four type tiers. */
const SLUG = "article-teaser";

export function typographyPairing(trial: Trial): GraderResult {
  if (trial.target.slug !== SLUG) {
    return notApplicable(
      "typography-pairing",
      "contract",
      `only ${SLUG} pairs display and copy type`,
    );
  }

  // Every `.scss` in the component directory, concatenated — the same set the
  // sandbox reads, including the token partial, because the categories may
  // legitimately live one hop away from the rule that uses them.
  const dir = trial.target.dir;
  const styles = filesIn(trial, dir)
    .filter((name) => name.endsWith(".scss"))
    .map((name) => readFile(trial, `${dir}/${name}`) ?? "")
    .join("\n");

  if (!styles.trim()) {
    return notApplicable(
      "typography-pairing",
      "contract",
      "no stylesheet to read",
    );
  }

  const checks = checkTypographyPairing({
    styles,
    slug: SLUG,
    elements: PAIRING_ELEMENTS,
  }).map((entry) =>
    entry.passed
      ? check(entry.id, entry.label, true)
      : check(entry.id, entry.label, false, entry.details),
  );

  return result("typography-pairing", "contract", checks);
}
