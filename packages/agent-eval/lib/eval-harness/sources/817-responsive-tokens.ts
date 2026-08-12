/**
 * 817 — stop hand-rolling breakpoints the token system already handles.
 *
 * `--ks-spacing-*` is not a static scale. Each step is
 * `calc(var(--ks-spacing-m-base) * var(--ks-spacing-m-bp-factor))`, and the
 * bp-factor is redefined inside media queries in `spacing-token.scss`. Using
 * the token therefore *is* the responsive behaviour; a component that writes
 * its own `@media` blocks to step its padding has reimplemented the scale by
 * hand, at its own breakpoints, and has opted out of every future retune.
 *
 * This is the sharpest test of the design-tokens server in the suite. The right
 * answer is not "look up a token name" — 812 and 811 already ask that. It is
 * "know that the scale is responsive, and therefore that three declarations and
 * two media queries collapse into two declarations". An agent that only knows
 * token *names* will dutifully swap the literals inside the media queries and
 * keep the queries, which is why the query check is separate from the token
 * check: that partial answer has to be distinguishable from the real one.
 *
 * The fixture's breakpoints (48em/64em) are deliberately *not* the token
 * system's (36em/48em/…), so the brief's complaint — that the header steps at
 * different points than everything else — is true rather than decorative.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/page-header",
  slug: "page-header",
  pascal: "PageHeader",
  renderProps: {
    title: "Rolling out the new spacing scale",
    summary: "What changes, what doesn't, and when it lands.",
    eyebrow: "Platform",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  component: shipped("src/components/page-header/PageHeaderComponent.tsx"),
  schema: shipped("src/components/page-header/page-header.schema.json"),
};

/** Every `.scss` file in the component directory, concatenated. */
const allStyles = (): string =>
  readdirSync(harness.dir)
    .filter((name) => name.endsWith(".scss"))
    .map((name) => read(`${harness.dir}/${name}`))
    .join("\n");

/**
 * The value of a declaration, following one hop through a component token.
 *
 * Introducing a `--dsa-page-header--padding` that resolves to a spacing token
 * is a legitimate — arguably better — answer, so the check has to see through
 * that layer rather than insist the semantic token appears in the rule itself.
 */
const resolved = (property: string): string => {
  const declared = allStyles().match(
    new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;}]+)`, "m"),
  )?.[1];
  if (!declared) return "";

  const componentToken = declared.match(/var\(\s*(--dsa-[a-z0-9_-]+)/)?.[1];
  if (!componentToken) return declared;

  const indirect = allStyles().match(
    new RegExp(`${componentToken}\\s*:\\s*([^;]+);`),
  )?.[1];
  return `${declared} ${indirect ?? ""}`;
};

/* ─────────────────────────────── the fix ───────────────────────────────── */

test("spacing comes from the spacing scale", () => {
  expect(resolved("gap")).toContain("var(--ks-spacing-");
  expect(resolved("padding")).toContain("var(--ks-spacing-");
});

test("the component no longer defines its own breakpoints", () => {
  // Separate from the token check on purpose. Swapping the literals inside the
  // media queries for tokens satisfies the assertion above while leaving the
  // component pinned to its own breakpoints — a half-fix that would otherwise
  // score the same as the real one.
  expect(allStyles()).not.toMatch(/@media[^{]*\(\s*(min|max)-width/);
});

test("no hand-set lengths are left in the spacing declarations", () => {
  for (const property of ["gap", "padding"]) {
    expect(resolved(property)).not.toMatch(/\d+(\.\d+)?(rem|px|em)\b/);
  }
});

/* ──────────────────────────── nothing else moves ────────────────────────── */

test("the type styles are left alone", () => {
  // Named as out of scope in the brief. They are already tokenised, so touching
  // them is drift, not improvement.
  const styles = allStyles();
  for (const token of [
    "--ks-font-copy-s",
    "--ks-font-display-s",
    "--ks-font-copy-m",
    "--ks-text-color-copy",
    "--ks-text-color-display",
  ]) {
    expect(styles).toContain(token);
  }
});

test("the stylesheet keeps its structure", () => {
  const styles = read(FILES.styles);
  for (const selector of ["&__eyebrow", "&__title", "&__summary"]) {
    expect(styles).toContain(selector);
  }
});

test("the component is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});

test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});

test("no unrelated files are added to the component", () => {
  // Stylesheets exempt: lifting the values into a `_page-header-tokens.scss`
  // partial is a reasonable way to do this. Everything else is absolute, per
  // D-105.
  const shippedFiles = new Set([
    "PageHeaderComponent.tsx",
    "page-header.scss",
    "page-header.schema.json",
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
