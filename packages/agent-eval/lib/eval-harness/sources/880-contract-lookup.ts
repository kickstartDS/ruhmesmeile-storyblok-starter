/**
 * 880 — answer questions only the contract answers.
 *
 * Every other eval in the suite asks whether having a server *helps* on a task
 * the agent could already do. This one asks the prior question: does the
 * contract layer carry information nothing else in the fixture carries? The
 * eight facts are chosen because they exist nowhere in the checkout —
 * `--dsa-button_primary--background-color`, `c-button--outline`,
 * `root/item/answer`, `28` accepted component types — and the fixture ships
 * only the global `--ks-*` token layer, never the component layer or any
 * component's source.
 *
 * Consequences worth stating, because they invert how the other evals read:
 *
 *   - The **gate** is structural only: all eight keys answered. Correctness is
 *     scored by the host grader `contract-lookup`, which compares the answers
 *     against the committed contract set itself and so cannot drift from it.
 *     `pass@1` here means "answered everything", not "got them right".
 *   - `mcpUseExpected: true`. A trial that never reached an MCP cannot have the
 *     answers, so it measured the baseline; the confound classifier excludes it
 *     rather than counting eight confident guesses as a data point.
 *
 * See `lib/eval-harness/sources/` for why this is not in the fixture.
 */

import { existsSync, readFileSync } from "node:fs";

import { expect, test } from "vitest";

import { captureTranscript } from "../harness";

captureTranscript();

const ANSWERS = "answers.json";

/**
 * Kept in step with `lib/graders/contract-lookup.ts`, which holds the expected
 * values and reads them from the committed contract set.
 */
const QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"] as const;

test("every question is answered", () => {
  expect(
    existsSync(ANSWERS),
    `${ANSWERS} was not written at the repository root`,
  ).toBe(true);

  const parsed = JSON.parse(readFileSync(ANSWERS, "utf-8")) as Record<
    string,
    unknown
  >;
  expect(typeof parsed, `${ANSWERS} is not a JSON object`).toBe("object");

  for (const id of QUESTIONS) {
    const value = parsed[id];
    expect(
      value !== undefined &&
        value !== null &&
        (Array.isArray(value) ? value.length > 0 : String(value).trim() !== ""),
      `${id} is unanswered`,
    ).toBe(true);
  }
});
