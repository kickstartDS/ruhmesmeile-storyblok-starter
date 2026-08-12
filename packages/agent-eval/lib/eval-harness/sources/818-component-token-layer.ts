/**
 * 818 — give a component the token layer it never got.
 *
 * The design system's token architecture has three layers: branding
 * (`--ks-brand-*`), semantic (`--ks-*`), and component (`--dsa-*`). A component
 * stylesheet is supposed to consume the component layer, and the component
 * layer is what references the semantic one. `Callout` skips the middle: it
 * reaches straight for `--ks-*`, so nothing about it can be retuned without
 * editing the stylesheet.
 *
 * Both servers under test have a claim on this. `component-builder` hands out
 * an SCSS template that spells out all three layers and the `--dsa-` prefix;
 * `design-tokens` documents the architecture and can name the semantic tokens
 * to reference. So unlike most of the suite this one does not predict which
 * server helps — it asks whether either does, and whether holding both is
 * better than holding the more specific one. `cc-both` never beat
 * `component-builder` alone in Phase 1 (ADR 62); this is a task where, on
 * paper, it should.
 *
 * What is deliberately *not* asserted: that the tokens live in a separate
 * `_callout-tokens.scss` partial. That is the house convention, but defining
 * them in a `.dsa-callout` block at the top of the stylesheet is also a
 * coherent reading of the brief, and 861 already cost us one draft that failed
 * the more idiomatic of two legitimate answers. Which file the layer lands in
 * is a quality signal, and `style-placement` already scores it. The gate here
 * is the layering itself.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/callout",
  slug: "callout",
  pascal: "Callout",
  renderProps: {
    heading: "Before you migrate",
    body: "Existing themes keep their current values until you opt in.",
    emphasis: "strong",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  component: shipped("src/components/callout/CalloutComponent.tsx"),
  schema: shipped("src/components/callout/callout.schema.json"),
};

/**
 * The semantic tokens the fixture shipped.
 *
 * The brief says the values must not change, only where they live. Every one of
 * these has to still be referenced somewhere in the component after the move —
 * that is what "nothing about how it looks should change" means in a form the
 * harness can check.
 */
const SEMANTIC = [
  "--ks-spacing-stack-s",
  "--ks-spacing-inset-m",
  "--ks-border-width-default",
  "--ks-border-color-default",
  "--ks-font-copy-s",
  "--ks-font-weight-bold",
  "--ks-text-color-display",
  "--ks-font-copy-m",
  "--ks-text-color-copy",
  "--ks-text-color-primary",
];

/** Every `.scss` file in the component directory, concatenated. */
const allStyles = (): string =>
  readdirSync(harness.dir)
    .filter((name) => name.endsWith(".scss"))
    .map((name) => read(join(harness.dir, name)))
    .join("\n");

/** `--dsa-*` custom properties defined (not merely referenced) anywhere. */
const definedComponentTokens = (): Map<string, string> => {
  const defined = new Map<string, string>();
  for (const [, name, value] of allStyles().matchAll(
    /(--dsa-[a-z0-9_-]+)\s*:\s*([^;]+);/g,
  )) {
    defined.set(name, value.trim());
  }
  return defined;
};

/**
 * Declarations in the stylesheet, excluding custom-property definitions.
 *
 * Used to check what the rules consume. A declaration whose value names no
 * token at all (`margin: 0`, `display: flex`) is not interesting either way.
 */
const declarations = (): { property: string; value: string }[] =>
  [...read(FILES.styles).matchAll(/(^|[;{}\s])([a-z-]+)\s*:\s*([^;{}]+);/g)]
    .map((match) => ({ property: match[2], value: match[3].trim() }))
    .filter(({ property }) => !property.startsWith("--"));

/* ─────────────────────────────── the fix ───────────────────────────────── */

test("a component token layer exists", () => {
  const defined = definedComponentTokens();
  // Ten semantic values in the fixture. Requiring one token per value would
  // over-specify — grouping `border-width` and `border-color` into a single
  // `--dsa-callout--border` shorthand is a defensible design — but a layer with
  // only one or two tokens in it has not actually been introduced.
  expect(defined.size).toBeGreaterThanOrEqual(5);
});

test("the component tokens are namespaced to the component", () => {
  for (const name of definedComponentTokens().keys()) {
    expect(name).toMatch(/^--dsa-callout(--|__)/);
  }
});

test("the component layer references the semantic layer", () => {
  // The rule that makes the architecture worth having: a component token whose
  // value is a literal has re-hardcoded the thing it was meant to lift out, and
  // a theme change at the semantic layer will no longer reach this component.
  for (const [name, value] of definedComponentTokens()) {
    expect(`${name}: ${value}`).toContain("var(--ks-");
  }
});

test("the rules consume the component layer", () => {
  // A stylesheet that still reads `--ks-*` directly has gained a partial and
  // changed nothing. A `--ks-*` *fallback* inside `var(--dsa-…, var(--ks-…))`
  // is idiomatic here and stays legal — the check is that the component token
  // is reached for first.
  const direct = declarations().filter(
    ({ value }) => value.includes("var(--ks-") && !value.includes("var(--dsa-"),
  );
  expect(direct.map((d) => d.property)).toEqual([]);
});

/* ──────────────────────────── nothing else moves ────────────────────────── */

test("the shipped values are preserved", () => {
  const styles = allStyles();
  for (const token of SEMANTIC) {
    expect(styles).toContain(token);
  }
});

test("the stylesheet keeps its structure", () => {
  const styles = read(FILES.styles);
  for (const selector of ["&__heading", "&__body", "&--strong"]) {
    expect(styles).toContain(selector);
  }
});

test("a separate token file is actually included", () => {
  // A partial nobody `@use`s is dead code, and the component silently falls
  // back to unset custom properties. Only checked when the agent chose to split
  // the file; defining the layer inline is a legitimate answer.
  const partials = readdirSync(harness.dir).filter(
    (name) => name.endsWith(".scss") && name !== "callout.scss",
  );
  const styles = read(FILES.styles);
  for (const partial of partials) {
    const stem = partial.replace(/^_/, "").replace(/\.scss$/, "");
    expect(styles).toMatch(
      new RegExp(`@(use|import|forward)\\s+["'][^"']*${stem}`),
    );
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
  // Absolute apart from stylesheets, for the reason recorded in 861 (D-105):
  // exempting `*.stories.*` hides the arm most likely to leave one behind.
  // Stylesheets are exempt because adding one is the task.
  const shippedFiles = new Set([
    "CalloutComponent.tsx",
    "callout.scss",
    "callout.schema.json",
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
