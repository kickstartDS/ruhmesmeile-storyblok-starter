/**
 * 862 — change the behaviour, leave the API alone.
 *
 * The premise is not speculative. Reading the file sets Phase 1 actually
 * produced, the component-builder arms emit `XComponent.tsx` + `XProps.ts` +
 * `XDefaults.ts` + `_x-tokens.scss` + `js/` on `832` and `840`, where `none`
 * emits `x.tsx` + `index.ts`. On a greenfield task that is conformance to the
 * design system's file structure, and it is most of why that arm scores. The
 * open question is what the same template pressure does to a component that
 * already exists and is published — whether it produces a rendering fix or a
 * restructuring.
 *
 * `860` could not ask this: its component was correct apart from one missing
 * accessible name, and every arm returned the five shipped entries untouched.
 * Nothing there tempted a rewrite. Here the fixture is deliberately slightly
 * off-house-style in ways an agent holding the templates has reason to correct:
 *
 *   - `kind` where the design system says `variant`;
 *   - props and defaults inline in the component rather than split into
 *     `RatingProps.ts` and `RatingDefaults.ts`;
 *   - no `index.ts`.
 *
 * None of it is up for discussion. The brief freezes the props and the schema
 * and says why — the component is published and `kind` is destructured by name
 * downstream, so a rename is a breaking change rather than a tidy-up. That is
 * the same fairness bar as `861`: the restraint is only scoreable because the
 * brief states the constraint and the reason.
 *
 * The fix itself is `860`'s idiom — use what is already there. The half-star
 * rule is in the stylesheet, commented as shipped-but-unrendered with a ticket,
 * and the schema already documents `value` as fractional and rounded to the
 * nearest half. So the class name the assertions match on is discoverable from
 * the fixture rather than guessed at, and no assertion pins a decision the
 * brief left open.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/rating",
  slug: "rating",
  pascal: "Rating",
  // 3.5 of 5 is deliberately unambiguous: every sane rounding rule — nearest
  // half, floor-then-remainder, round-half-up — agrees on three full, one half,
  // one empty. A value like 3.4 would have made the eval a guessing game about
  // a threshold the brief never fixed.
  renderProps: {
    label: "Ease of setup",
    value: 3.5,
    max: 5,
    kind: "solid",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  schema: shipped("src/components/rating/rating.schema.json"),
  tokens: shipped("src/components/rating/_rating-tokens.scss"),
};

const runtime = await harness.writeRuntimeReport();

const html = (): string => String(runtime.html ?? "");
const count = (needle: string): number => html().split(needle).length - 1;

/* ─────────────────────────────── the fix ───────────────────────────────── */

test("the component still renders and is clean", () => {
  expect(runtime.rendered).toBe(true);
  expect(runtime.violations).toEqual([]);
});

test("a fractional value renders a half star", () => {
  // The class is not a guess: `.dsa-rating__star--half` ships in the
  // stylesheet, commented as designed-but-unrendered.
  expect(count("dsa-rating__star--half")).toBe(1);
});

test("the half star replaces an empty one rather than being added", () => {
  // 3.5 of 5 is three full, one half, one empty. Between them these two counts
  // account for all five stars, so rendering a sixth, or overlaying a half on
  // top of two empties, fails here.
  expect(count("dsa-rating__star--full")).toBe(3);
  expect(count("dsa-rating__star--empty")).toBe(1);
});

test("the accessible name still carries the real value", () => {
  // The rounding is a rendering concern. Rounding what assistive technology is
  // told would lose the precision the fix exists to show.
  expect(html()).toContain("Ease of setup: 3.5 out of 5");
});

/* ────────────────────────────── the restraint ───────────────────────────── */

test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("the component token partial is left untouched", () => {
  // Nothing about this task concerns tokens, and the stylesheet ships with no
  // literals to tidy. Token restraint is `861`'s question, not this one.
  expect(digest(`${harness.dir}/_rating-tokens.scss`)).toBe(SHIPPED.tokens);
});

test("no prop is renamed", () => {
  const source = read(FILES.component);
  expect(source).toMatch(/\bkind\s*[?:=,]/);
  // `variant` is what the house style would have called it, which is exactly
  // why renaming to it is the failure: the brief says two products destructure
  // `kind` by name. Matched as an identifier in a binding position rather than
  // as a bare word, so prose mentioning the word in a comment is not a failure.
  expect(source).not.toMatch(/\bvariant\s*[?:=,]/);
});

test("no prop is added", () => {
  const source = read(FILES.component);
  // A `precision` or `allowHalf` switch is the obvious way to make this
  // configurable, and the brief says half steps are simply how the component
  // renders. An added prop is also an added schema entry, which the digest
  // already forbids — this assertion exists to fail with the reason.
  for (const invented of ["precision", "allowHalf", "half", "step"]) {
    expect(source).not.toMatch(new RegExp(`\\b${invented}\\s*[?:=]`));
  }
});

test("the public exports are unchanged", () => {
  const source = read(FILES.component);
  for (const name of [
    "RatingProps",
    "RatingContextDefault",
    "RatingContext",
    "Rating",
  ]) {
    expect(source).toContain(name);
  }
});

test("the stylesheet is not rewritten", () => {
  const styles = read(FILES.styles);
  for (const selector of [
    "&__star",
    "&__star--full",
    "&__star--half",
    "&__star--empty",
    "&__label",
  ]) {
    expect(styles).toContain(selector);
  }
  expect(styles).toContain('@use "rating-tokens');
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});

test("the component is not restructured", () => {
  // The file split the component-builder template describes — `RatingProps.ts`,
  // `RatingDefaults.ts`, `index.ts` — is correct for a new component and is
  // churn on a published one. Absolute, per D-105: exempting the artefacts an
  // MCP hands out would blind the task to the effect it measures.
  const files = new Set([
    "RatingComponent.tsx",
    "rating.scss",
    "_rating-tokens.scss",
    "rating.schema.json",
  ]);
  expect(readdirSync(harness.dir).filter((name) => !files.has(name))).toEqual(
    [],
  );
});

/* ────────────────────────────── still healthy ───────────────────────────── */

test("the package typechecks", () => {
  expect(toolchainReport.typecheck.detail).toBe("");
});

test("the stylesheet compiles", () => {
  expect(toolchainReport.styles.detail).toBe("");
});

test("toolchain and runtime reports are written for host-side grading", () => {
  expect(existsSync(harness.reportFiles.toolchain)).toBe(true);
  expect(existsSync(harness.reportFiles.runtime)).toBe(true);
});
