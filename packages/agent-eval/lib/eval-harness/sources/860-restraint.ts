/**
 * 860 — fix what was reported, and nothing else.
 *
 * Every other eval in the suite rewards producing more. That is a one-sided
 * optimisation target, and the matrix suggests it matters: the `both` variant
 * spent 3.98× the output tokens of baseline and 7.08× the money for +0.02
 * quality over component-builder alone. If MCP context also makes agents
 * rewrite things nobody asked them to touch, that cost is not just wasted — it
 * is a diff a reviewer has to read and a regression risk on a shipped
 * component.
 *
 * The fixture is complete and correct apart from one real axe violation: the
 * remove control has no accessible name. The API already carries `removeLabel`,
 * so the minimal correct fix is to apply the prop that is already there.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/tag",
  slug: "tag",
  pascal: "Tag",
  renderProps: {
    label: "Design system",
    removable: true,
    removeLabel: "Remove Design system",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

// Injected by bin/build-evals.ts from the fixture itself, so the expected
// digest and the shipped file cannot drift apart. A pasted hash did drift, and
// failed all four arms for leaving the file correctly untouched.
const SHIPPED = {
  schema: shipped("src/components/tag/tag.schema.json"),
  client: shipped("src/components/tag/js/Tag.client.js"),
  tokens: shipped("src/components/tag/_tag-tokens.scss"),
};

const runtime = await harness.writeRuntimeReport();

/* ─────────────────────────────── the fix ───────────────────────────────── */

test("the reported violation is gone", () => {
  expect(runtime.rendered).toBe(true);
  expect(runtime.violations).toEqual([]);
});

test("the remove control has an accessible name", () => {
  // Scoped to the button. Matching the label anywhere in the document would
  // also match a stray data attribute, which is not a name any screen reader
  // will read out.
  const html = String(runtime.html ?? "");
  const button = html.match(/<button[\s\S]*?<\/button>/)?.[0] ?? "";
  expect(button).toMatch(/Remove Design system/);
});

test("the accessible name comes from the existing prop", () => {
  // `removeLabel` is already in the schema and already threaded into the
  // component. Hardcoding a string instead leaves the documented prop inert and
  // the component untranslatable.
  const source = read(FILES.component);
  expect(source).toMatch(/removeLabel/);
});

/* ────────────────────────────── the restraint ───────────────────────────── */

test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("unrelated client behaviour is left untouched", () => {
  expect(digest(`${harness.dir}/js/Tag.client.js`)).toBe(SHIPPED.client);
});

test("the component token partial is left untouched", () => {
  expect(digest(`${harness.dir}/_tag-tokens.scss`)).toBe(SHIPPED.tokens);
});

test("the stylesheet is not rewritten", () => {
  // Not hashed: an accessible name delivered as visually-hidden text is a
  // legitimate fix and needs a rule. Losing existing selectors is not.
  const styles = read(FILES.styles);
  for (const selector of [
    ".dsa-tag",
    ".dsa-tag__label",
    ".dsa-tag__remove",
    ".dsa-tag__remove-icon",
  ]) {
    expect(styles).toContain(selector);
  }
  // Match up to the token name only. The literal used to carry a closing
  // quote, which silently pinned the bare `@use "tag-tokens"` form and failed
  // the moment the fixture adopted the house `.scss` extension (ADR 48/49).
  expect(styles).toContain('@use "tag-tokens');
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});

test("no unrequested files are added to the component", () => {
  const shipped = new Set([
    "TagComponent.tsx",
    "tag.scss",
    "_tag-tokens.scss",
    "tag.schema.json",
    "js",
  ]);
  const added = readdirSync(harness.dir)
    .filter((name) => !shipped.has(name))
    // A test covering the fix is defensible practice, not scope creep.
    .filter((name) => !/\.(test|spec|stories)\./.test(name));
  expect(added).toEqual([]);
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
