/**
 * 806 — stop hand-rolling an inversion the token system already performs.
 *
 * `Spotlight` ships hardcoded colours plus a `prefers-color-scheme: dark`
 * block. The design system does not do it that way: `[ks-inverted="true"]`
 * redefines the semantic colour tokens themselves, so a component that reaches
 * for `--ks-text-color-*` and `--ks-background-color-*` inverts inside a
 * flipped region and does nothing outside one, with no per-component rules at
 * all. Nine hundred lines of `background-color-token.scss` exist so that this
 * component's stylesheet can be shorter, not longer.
 *
 * This is the task in the suite that most directly asks what the tokens
 * server is for. The information needed — that the inversion lives in the
 * token layer and not in the component — is not derivable from the component,
 * is not something a model can guess from the CSS it was handed, and is
 * exactly what `design-tokens` documents. Phase 1 found that `design-tokens`
 * never flipped a task's outcome (ADR 62); if it does not flip this one, that
 * is a strong result about the server rather than about the suite.
 *
 * The sharp assertion is `the inversion is not reimplemented`. Writing
 * `[ks-inverted="true"] { … }` rules inside the component is the answer that
 * looks right, passes review, and means the agent found the attribute without
 * finding what it does. Both hand-rolled dark modes are wrong for the same
 * reason and the task is not worth running if it only catches the first.
 *
 * What is deliberately *not* asserted: which colour tokens are chosen. Several
 * families invert (`default`, `card`, `interface`), and picking among them is
 * a judgement call the rubrics score, not a gate.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/spotlight",
  slug: "spotlight",
  pascal: "Spotlight",
  renderProps: {
    heading: "What the token layer buys you",
    body: "Components stop carrying their own themes, and start carrying none.",
    footnote: "From the migration notes, October.",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  component: shipped("src/components/spotlight/SpotlightComponent.tsx"),
  schema: shipped("src/components/spotlight/spotlight.schema.json"),
};

/** Every stylesheet in the component directory, concatenated. */
function allStyles(): string {
  return readdirSync(harness.dir)
    .filter((name) => name.endsWith(".scss"))
    .map((name) => read(`${harness.dir}/${name}`))
    .join("\n");
}

const COLOUR_PROPERTIES =
  /^\s*(color|background|background-color|border|border-color|border-[a-z-]*color|fill|stroke|outline|outline-color|box-shadow)\s*:\s*([^;]+);/gm;

/** Property/value pairs for declarations that set a colour. */
function colourDeclarations(): Array<[string, string]> {
  return [...allStyles().matchAll(COLOUR_PROPERTIES)].map((match) => [
    match[1],
    match[2].trim(),
  ]);
}

const LITERAL_COLOUR =
  /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|color-mix|lab|oklch)\(|\b(white|black|silver|gray|grey|red|blue|green)\b/i;

/* ────────────────────────── the wrong mechanism ─────────────────────────── */

test("the component no longer carries its own dark mode", () => {
  expect(allStyles()).not.toMatch(/prefers-color-scheme/);
});

test("the inversion is not reimplemented", () => {
  // Swapping `prefers-color-scheme` for a hand-written `[ks-inverted]` block
  // trades one duplicated theme for another. The tokens already redefine
  // themselves under that attribute; a component that repeats the rules has
  // found the selector and missed the point.
  expect(allStyles()).not.toMatch(/\[\s*ks-inverted/);
});

/* ─────────────────────────── the right one ──────────────────────────────── */

test("no colour is written as a literal", () => {
  for (const [property, value] of colourDeclarations()) {
    expect(`${property}: ${value}`).not.toMatch(LITERAL_COLOUR);
  }
});

test("colours come from the token system", () => {
  const declarations = colourDeclarations();
  expect(declarations.length).toBeGreaterThan(0);
  for (const [property, value] of declarations) {
    // A `--dsa-` component layer is a legitimate intermediate step, so a
    // custom property of either prefix satisfies this; the previous assertion
    // is what stops a `--dsa-` token being handed a literal.
    expect(`${property}: ${value}`).toMatch(/var\(--(ks|dsa)-/);
  }
});

test("the colours that invert are actually reached for", () => {
  // `--ks-color-*` is the branding layer and does not invert; the semantic
  // families do. Reaching past the semantic layer produces a component that
  // is tokenised and still does not flip.
  const styles = allStyles();
  expect(styles).toMatch(/var\(--ks-(text|background|border)-color-/);
});

/* ────────────────────────────── within bounds ───────────────────────────── */

test("the component is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});

test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("spacing and type are left alone", () => {
  // The brief says so explicitly. These are the shipped values; a rewrite that
  // "tidied them up on the way past" is out of scope.
  const styles = allStyles();
  for (const token of [
    "--ks-spacing-stack-s",
    "--ks-spacing-inset-m",
    "--ks-font-display-s",
    "--ks-font-copy-m",
    "--ks-font-copy-s",
  ]) {
    expect(styles).toContain(token);
  }
});

test("the stylesheet keeps its structure", () => {
  const styles = read(FILES.styles);
  for (const selector of ["&__heading", "&__body", "&__footnote"]) {
    expect(styles).toMatch(new RegExp(`${selector}(?![\\w-])`));
  }
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});

test("no unrelated files are added to the component", () => {
  // Absolute apart from stylesheets, for the reason recorded in 861 (D-105);
  // a `--dsa-` layer in its own partial is a legitimate way to do this.
  const shippedFiles = new Set([
    "SpotlightComponent.tsx",
    "spotlight.scss",
    "spotlight.schema.json",
  ]);
  const added = readdirSync(harness.dir).filter(
    (name) => !shippedFiles.has(name) && !name.endsWith(".scss"),
  );
  expect(added).toEqual([]);
});

/* ────────────────────────────── still healthy ───────────────────────────── */

test("the package typechecks", () => {
  expect(toolchainReport.typecheck.detail).toBe("");
});

test("the stylesheet compiles", () => {
  expect(toolchainReport.styles.detail).toBe("");
});

test("toolchain and runtime reports are written for host-side grading", async () => {
  const runtime = await harness.writeRuntimeReport();

  expect(runtime.rendered).toBe(true);
  expect(runtime.violations).toEqual([]);
  expect(existsSync(harness.reportFiles.toolchain)).toBe(true);
  expect(existsSync(harness.reportFiles.runtime)).toBe(true);
});
