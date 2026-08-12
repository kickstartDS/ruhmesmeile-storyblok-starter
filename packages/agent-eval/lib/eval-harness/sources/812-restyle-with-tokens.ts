/**
 * 812 — restyle an existing component onto the token layer.
 *
 * Why this task exists: on `810-atom-from-schema` the design-tokens MCP moved
 * quality by +0.04 against baseline, well inside the ±0.06 run-to-run noise,
 * while component-builder moved it +0.23. That is a weak result for a server
 * with 29 tools, but 810 is an *authoring* task where most of the score is file
 * layout, purity and ref forwarding — none of which a token server can help
 * with. This task strips the authoring work away and leaves only the question
 * the tokens MCP exists to answer: which token replaces this literal.
 *
 * The component and its schema ship complete and correct; only the stylesheet
 * is wrong. See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/alert",
  slug: "alert",
  pascal: "Alert",
  renderProps: {
    title: "Payment method expired",
    message: "Update your card details to keep your subscription active.",
    variant: "warning",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

// Baked in rather than recomputed, so "unchanged" means what the fixture
// shipped, not whatever happens to be on disk when the assertion runs.
const SHIPPED = {
  component: shipped("src/components/alert/AlertComponent.tsx"),
  schema: shipped("src/components/alert/alert.schema.json"),
};

test("the component file is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});

test("the provided schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

/**
 * Collapses `var()` calls whose fallback is itself a token, innermost first, so
 * that only a *literal* in a fallback slot is left behind for the assertions
 * below to find.
 *
 * This check used to collapse every `var()` regardless of its fallback, on the
 * stated grounds that "the design system's own token partials carry fallbacks
 * exactly like that". A census of all 68 components says otherwise: 149 `var()`
 * fallbacks, every one of them `var(--x, var(--y))`, and not a single literal
 * colour among them. The house style is token to token, all the way down the
 * branding → semantic → component layering.
 *
 * So `var(--ks-color-positive, #059669)` is not house style, it is a hardcoded
 * colour wearing a token's clothes — a baseline run cleared this task's colour
 * assertion by writing exactly that. The `token-conformance` grader always
 * scored it as a defect; this eval was the lenient one. (ADR 63.)
 */
function withoutTokenFallbacks(css: string): string {
  let previous;
  let collapsed = css;
  do {
    previous = collapsed;
    // A bare `var(--x)`, or one whose fallback has already collapsed to VAR.
    collapsed = collapsed.replace(
      /var\(\s*--[\w-]+\s*(?:,\s*VAR\s*)?\)/g,
      "VAR",
    );
  } while (collapsed !== previous);
  return collapsed;
}

test("no literal colour values survive in the stylesheet", () => {
  const styles = withoutTokenFallbacks(read(FILES.styles));
  const literals =
    styles.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g) ?? [];
  expect(literals).toEqual([]);
});

test("no literal font sizes, spacing or radii survive in the stylesheet", () => {
  const styles = withoutTokenFallbacks(read(FILES.styles));
  // Anything with a px/rem/em length on a property the fixture hardcoded. `0`
  // is unitless and legitimate, so it is not matched.
  const declarations = styles.match(
    /(?:padding|margin|gap|border-radius|font-size|line-height|border-left-width)\s*:[^;]*\b\d+(?:\.\d+)?(?:px|rem|em)\b/g,
  );
  expect(declarations ?? []).toEqual([]);
});

test("the stylesheet reads from the token layer", () => {
  expect(read(FILES.styles)).toMatch(/var\(--/);
});

test("the variants remain visually distinguishable", () => {
  // The whole authored stylesheet layer, not just `alert.scss`. Declaring the
  // three modifiers in `_alert-tokens.scss` as token overrides and consuming
  // them from the base rule is a defensible split, and reading only
  // `alert.scss` failed it — a latent false negative that Phase 1 happened not
  // to trip on any of the four arms. A check named for distinguishability has
  // no business deciding *where* the variants live; the `_{slug}-tokens.scss`
  // convention is enforced by its own assertion below. (D-115.)
  const partial = `${harness.dir}/_alert-tokens.scss`;
  const styles =
    read(FILES.styles) + (existsSync(partial) ? read(partial) : "");
  // `info` is the base state and carries no modifier of its own, so only the
  // three real modifiers are required. Both the flat and the nested spelling
  // count — `&--success` inside `.dsa-alert` is idiomatic SCSS and compiles to
  // the same selector.
  for (const variant of ["success", "warning", "danger"]) {
    expect(styles).toMatch(new RegExp(`(?:\\.dsa-alert--|&--)${variant}\\b`));
  }
});

test("per-component styling hooks are exposed as a token partial", () => {
  // 41 of the 68 design-system components ship `_{slug}-tokens.scss`. This is
  // the convention a restyle is supposed to follow; hardcoding semantic tokens
  // directly into rules works but gives consumers nothing to override.
  expect(existsSync(`${harness.dir}/_alert-tokens.scss`)).toBe(true);
});

test("toolchain and runtime reports are written for host-side grading", async () => {
  await harness.writeRuntimeReport();
  expect(existsSync(harness.reportFiles.toolchain)).toBe(true);
});

test("the package typechecks", () => {
  expect(toolchainReport.typecheck.detail).toBe("");
});

test("the stylesheet compiles", () => {
  expect(toolchainReport.styles.detail).toBe("");
});
