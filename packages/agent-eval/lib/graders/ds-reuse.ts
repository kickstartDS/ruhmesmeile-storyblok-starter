/**
 * 1.6 — design-system reuse.
 *
 * Inapplicable until the fixture ships the design system to reuse (P1 fixture
 * work). Returning "not applicable" rather than a free pass keeps the grader in
 * the report as a visible gap instead of quietly inflating every score.
 */

import { discoverGraded, stripComments } from "./discover";
import { check, result, notApplicable, type GraderResult } from "./types";
import { readFile, type Trial } from "./trial";

export function dsReuse(trial: Trial): GraderResult {
  const { delegatedElements } = trial.target;
  if (delegatedElements.length === 0) {
    return notApplicable(
      "ds-reuse",
      "contract",
      "fixture ships no design system to delegate to",
    );
  }

  const found = discoverGraded(trial);
  if (!found.component) {
    return notApplicable("ds-reuse", "contract", "no component file to grade");
  }

  const source = stripComments(readFile(trial, found.component) ?? "");
  const handRolled = delegatedElements.filter((element) =>
    new RegExp(`<${element}[\\s>]`).test(source),
  );

  return result("ds-reuse", "contract", [
    check(
      "no-hand-rolled-natives",
      "delegates to design-system components",
      handRolled.length === 0,
      handRolled.length
        ? `hand-rolled: <${handRolled.join(">, <")}>`
        : undefined,
    ),
    check(
      "imports-design-system",
      "imports from @kickstartds",
      /@kickstartds\//.test(source),
    ),
  ]);
}
