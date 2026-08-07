/**
 * 840 — compose from the design system instead of hand-rolling natives.
 *
 * Exists because of D-20: `ds-reuse` has reported "n/a" in every run of every
 * arm so far, because no fixture ships a design system to reuse. A whole
 * quality dimension has been carrying zero information, and it happens to be
 * the dimension closest to what the component-builder MCP claims to be for —
 * its `list-existing-components` tool is precisely a "check before you build"
 * affordance, and nothing has ever tested whether agents use it.
 *
 * The fixture vendors a four-component slice of the design system into
 * node_modules via a `file:` dependency. Hand-rolling `<button>` or a raw
 * heading is the failure this measures.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/notification-banner",
  slug: "notification-banner",
  pascal: "NotificationBanner",
  renderProps: {
    headline: "Scheduled maintenance on Sunday",
    message: "The dashboard will be read-only between 02:00 and 04:00 UTC.",
    variant: "info",
    actionLabel: "Read the details",
    actionIcon: "arrow-right",
  },
});

const { files: FILES, clientFile, read, toolchainReport } = harness;

/**
 * Strips comments before any check that reads the component as source.
 *
 * The schema's own description for `actionIcon` is "Icon identifier rendered
 * before the action label", and this design system's convention is to copy
 * field descriptions into JSDoc. A bare /\bIcon\b/ against raw source is
 * therefore satisfied by a doc comment alone — verified against a hand-rolled
 * implementation that copied the description, rendered an inline <svg>, and
 * still passed. Prose is not code, in either direction.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("component file follows the {Name}Component.tsx contract", () => {
  expect(existsSync(FILES.component)).toBe(true);
});

test("styles file follows the {slug}.scss contract", () => {
  expect(existsSync(FILES.styles)).toBe(true);
});

test("the provided schema is left untouched", () => {
  const schema = JSON.parse(read(FILES.schema));
  expect(Object.keys(schema.properties).sort()).toEqual([
    "actionIcon",
    "actionLabel",
    "dismissLabel",
    "headline",
    "message",
    "variant",
  ]);
});

test("the banner composes design-system components", () => {
  expect(withoutComments(read(FILES.component))).toMatch(
    /from\s+["']@kickstartds\//,
  );
});

test("the call to action is not a hand-rolled button", () => {
  // The vendored library exports Button. A raw <button> here re-implements
  // variant, size and icon slotting that already exist, and drifts the moment
  // the design system changes.
  expect(withoutComments(read(FILES.component))).not.toMatch(/<button[\s>]/);
});

test("the headline is not a hand-rolled heading element", () => {
  const source = withoutComments(read(FILES.component));
  expect(source).not.toMatch(/<h[1-6][\s>]/);
});

test("the action icon is rendered through the design system", () => {
  const source = withoutComments(read(FILES.component));
  expect(source).not.toMatch(/<svg[\s>]/);
  // Either the vendored `Icon` component directly, or the `icon` slot of a
  // design-system component that renders one — `Button` takes an `icon` prop
  // and is the more idiomatic composition of the two. Both are reuse; an
  // inline <svg> or a pasted glyph is not.
  expect(source).toMatch(/<Icon[\s/>]|(?<![\w-])icon=[{"']/);
});

test("component is pure — no React state or effects", () => {
  const source = read(FILES.component);
  for (const hook of [
    "useState",
    "useReducer",
    "useEffect",
    "useLayoutEffect",
  ]) {
    expect(source).not.toContain(hook);
  }
});

test("component forwards its ref", () => {
  expect(read(FILES.component)).toContain("forwardRef");
});

test("dismiss behaviour is implemented client-side, not in React", () => {
  const path = clientFile();
  expect(path).toBeDefined();
  const client = read(path!);
  expect(client.trim().length).toBeGreaterThan(0);
  expect(client).toMatch(/addEventListener/);
});

test("styles use design tokens rather than literal colour values", () => {
  const styles = read(FILES.styles);
  const literals = styles.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) ?? [];
  expect(literals).toEqual([]);
  expect(styles).toMatch(/var\(--/);
});

test("the banner does not restyle the components it composes", () => {
  // Reaching into `.dsa-button` from a consumer stylesheet is reuse in name
  // only: it couples the banner to another component's internals and breaks
  // silently when that component's markup changes.
  const styles = read(FILES.styles);
  for (const foreign of [".dsa-button", ".dsa-headline", ".dsa-icon"]) {
    expect(styles).not.toContain(foreign);
  }
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
