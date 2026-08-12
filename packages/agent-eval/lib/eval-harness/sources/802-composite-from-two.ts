/**
 * 802 — assemble from what the package already has, twice over.
 *
 * 840 asks whether an agent reaches for a *library* component instead of a
 * native element. This asks something the suite has never asked: whether it
 * looks at the package it is working in. `Portrait` and `RatingStars` ship
 * finished, styled and schema'd two directories away, and neither is imported
 * from anywhere — there is no existing usage to copy, only the components
 * themselves. Finding them is the task.
 *
 * Two of them on purpose. Reusing one and hand-rolling the other is the answer
 * this is built to catch, and it is the likely one: a circular portrait is a
 * `border-radius: 50%` an agent will type without thinking, while a five-star
 * row is enough work that it is tempting to look for. Grading the two
 * separately makes a half-composite distinguishable from a whole one.
 *
 * The `component-builder` server's `list-existing-components` tool is exactly
 * the affordance under test, and unlike 840 the answer is not in a vendored
 * package the agent can stumble into through `node_modules` — it is in the
 * source tree, which is the harder and more realistic place to have to look.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/testimonial",
  slug: "testimonial",
  pascal: "Testimonial",
  renderProps: {
    quote: "We shipped the redesign in a fortnight instead of a quarter.",
    authorName: "Mira Okonkwo",
    authorRole: "Head of Design, Northwind",
    portraitSrc: "/img/people/mira.jpg",
    rating: 5,
    ratingLabel: "Rated 5 out of 5",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

/** The two components that already exist, and every file they are made of. */
const SIBLINGS = [
  "src/components/portrait/PortraitComponent.tsx",
  "src/components/portrait/portrait.scss",
  "src/components/portrait/_portrait-tokens.scss",
  "src/components/portrait/portrait.schema.json",
  "src/components/rating-stars/RatingStarsComponent.tsx",
  "src/components/rating-stars/rating-stars.scss",
  "src/components/rating-stars/_rating-stars-tokens.scss",
  "src/components/rating-stars/rating-stars.schema.json",
];

const SHIPPED = Object.fromEntries(
  [...SIBLINGS, "src/components/testimonial/testimonial.schema.json"].map(
    (path) => [path, shipped(path)],
  ),
);

const RUNTIME = harness.writeRuntimeReport();
const html = async () => String((await RUNTIME).html ?? "");

/**
 * Strips comments before any check that reads the component as source.
 *
 * Per 840: this design system's convention is to copy schema descriptions into
 * JSDoc, so a bare pattern against raw source can be satisfied by prose alone.
 * Prose is not code, in either direction.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const source = () => withoutComments(read(FILES.component));

/* ────────────────────────── it exists at all ────────────────────────────── */

test("component file follows the {Name}Component.tsx contract", () => {
  expect(existsSync(FILES.component)).toBe(true);
});

test("styles file follows the {slug}.scss contract", () => {
  expect(existsSync(FILES.styles)).toBe(true);
});

test("the provided schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(
    SHIPPED["src/components/testimonial/testimonial.schema.json"],
  );
});

/* ──────────────────────── both halves are composed ──────────────────────── */

test("the author's picture is the package's Portrait", async () => {
  expect(source()).toMatch(/from\s+["']\.\.\/portrait/);
  expect(await html()).toContain("dsa-portrait");
});

test("the picture is not cropped by hand", async () => {
  // Copying the class name without the component passes the check above and
  // fails this one, which is the point of having both.
  expect(source()).not.toMatch(/<img[\s>]/);
  expect(read(FILES.styles)).not.toMatch(
    /border-radius\s*:\s*(50%|9999px|999rem)/,
  );
});

test("the score is the package's RatingStars", async () => {
  expect(source()).toMatch(/from\s+["']\.\.\/rating-stars/);
  expect(await html()).toContain("dsa-rating-stars");
});

test("the stars are not redrawn", () => {
  const component = source();
  expect(component).not.toMatch(/<svg[\s>]/);
  expect(component).not.toMatch(/[★☆]/);
  expect(read(FILES.styles)).not.toMatch(/__star(?![\w-])/);
});

test("it does not restyle the components it composes", () => {
  // Reaching into a sibling's BEM block from here is reuse in name only: it
  // couples the testimonial to another component's internals and breaks
  // silently when that component's markup changes.
  const styles = read(FILES.styles);
  for (const foreign of [".dsa-portrait", ".dsa-rating-stars"]) {
    expect(styles).not.toContain(foreign);
  }
});

/* ────────────────────── the package is left as found ────────────────────── */

test("the components it composes are untouched", () => {
  for (const path of SIBLINGS) {
    expect(digest(path), path).toBe(SHIPPED[path]);
  }
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});

/* ─────────────────────────── house conventions ──────────────────────────── */

test("component is pure — no React state or effects", () => {
  const component = read(FILES.component);
  for (const hook of [
    "useState",
    "useReducer",
    "useEffect",
    "useLayoutEffect",
  ]) {
    expect(component).not.toContain(hook);
  }
});

test("component forwards its ref", () => {
  expect(read(FILES.component)).toContain("forwardRef");
});

test("styles use design tokens rather than literal values", () => {
  const styles = read(FILES.styles);
  expect(styles.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) ?? []).toEqual([]);
  expect(styles).toMatch(/var\(--/);
});

test("no unrelated files are added to the component", () => {
  const allowed = new Set([
    "TestimonialComponent.tsx",
    "testimonial.scss",
    "testimonial.schema.json",
  ]);
  const added = readdirSync(harness.dir).filter(
    (name) => !allowed.has(name) && !name.endsWith(".scss"),
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

test("it renders cleanly", async () => {
  const runtime = await RUNTIME;

  expect(runtime.rendered).toBe(true);
  expect(runtime.violations).toEqual([]);
  expect(existsSync(harness.reportFiles.toolchain)).toBe(true);
  expect(existsSync(harness.reportFiles.runtime)).toBe(true);
});
