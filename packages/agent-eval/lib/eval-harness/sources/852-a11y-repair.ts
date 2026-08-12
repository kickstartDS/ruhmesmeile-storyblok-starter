/**
 * 852 — repair a component that never went through the accessibility checks.
 *
 * `MediaCard` renders an image with no alternative text, an icon-only button
 * with no accessible name, and a `<ul>` whose children are `<span>`s. All three
 * are things axe catches, all three are fixable without asking the card's
 * consumers for anything new, and none of them are visible in a screenshot.
 *
 * This one runs in the opposite direction to most of the suite: here the
 * component file is the thing that has to change, and the schema is what must
 * hold still. The brief pins the API explicitly ("keep the props exactly as
 * they are") because the lazy repair — adding an `imageAlt` prop and a
 * `saveLabel` prop — is a real answer to the accessibility problem and a bad
 * answer to the actual request. Every violation here has a fix that costs the
 * consumer nothing: `alt=""` for an image that sits next to its own heading,
 * a static label on a control whose meaning never varies, `<li>` for a list
 * item. Whether the agent finds those or reaches for new props is most of what
 * this task measures.
 *
 * What is deliberately *not* asserted: that the tag list stays a `<ul>`.
 * Promoting the `<span>`s to `<li>` is the better fix, but demoting the `<ul>`
 * to a `<div>` is a defensible reading — the tags are a row of labels, not
 * obviously a list — and 861 already cost us one draft that failed a
 * legitimate answer. The axe result covers both; only the axe result is
 * asserted.
 *
 * `mcpUseExpected` is false. Neither server documents accessibility, so this
 * task is a control: it should show little or no spread between the arms. A
 * task where the MCPs *shouldn't* help is worth having, because without one we
 * cannot tell an MCP effect from a "this arm had a longer prompt" effect.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/media-card",
  slug: "media-card",
  pascal: "MediaCard",
  renderProps: {
    title: "Rolling out the new token layer",
    summary:
      "What changes for teams already on a custom theme, and what does not.",
    imageSrc: "/img/token-layer.png",
    tags: ["Tokens", "Migration"],
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  schema: shipped("src/components/media-card/media-card.schema.json"),
};

/**
 * Rendered once, awaited by several tests.
 *
 * The runtime report is the fix assertion here, not just a health check, so
 * more than one test needs it and none of them should pay to render twice.
 */
const RUNTIME = harness.writeRuntimeReport();

/** The `<button>` element as it was rendered, tag and contents. */
function saveControl(html: string): string {
  return html.match(/<button\b[\s\S]*?<\/button>/)?.[0] ?? "";
}

/** Property names declared on the component's props interface. */
function declaredProps(): string[] {
  const source = read(FILES.component);
  const body = source.match(
    /interface\s+MediaCardProps\s*(?:extends[^{]+)?\{([\s\S]*?)\n\}/,
  )?.[1];
  if (body === undefined) return [];
  return [...body.matchAll(/^\s*(\w+)\??\s*:/gm)]
    .map((match) => match[1])
    .sort();
}

/* ──────────────────────────────── the repair ────────────────────────────── */

test("the card reports no accessibility violations", async () => {
  const runtime = await RUNTIME;
  expect(runtime.violations).toEqual([]);
});

test("the illustration carries alternative text", async () => {
  const runtime = await RUNTIME;
  // `alt=""` counts. An image sitting directly above its own heading is
  // decorative, and marking it so is the correct answer, not a dodge.
  expect(runtime.html).toMatch(/<img\b[^>]*\salt=/);
});

test("the save control has an accessible name", async () => {
  const runtime = await RUNTIME;
  const control = saveControl(String(runtime.html ?? ""));
  expect(control).not.toBe("");

  const labelled = /\b(aria-label|aria-labelledby|title)=/.test(control);
  const texted = control.replace(/<[^>]*>/g, "").trim().length > 0;
  expect(labelled || texted).toBe(true);
});

/* ────────────────────────────── within bounds ───────────────────────────── */

test("the API is unchanged", () => {
  // The brief pins this. Adding `imageAlt` and `saveLabel` would silence axe
  // and hand the problem to every consumer of the card.
  expect(declaredProps()).toEqual(["imageSrc", "summary", "tags", "title"]);
});

test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("the card keeps its markup landmarks", () => {
  const source = read(FILES.component);
  for (const className of [
    "dsa-media-card",
    "dsa-media-card__image",
    "dsa-media-card__title",
    "dsa-media-card__summary",
    "dsa-media-card__save",
  ]) {
    expect(source).toContain(className);
  }
});

test("the visual design is not rewritten", () => {
  // Restyling is not the assignment. The shipped rules must survive; adding a
  // visually-hidden helper class is expected and allowed.
  //
  // Matched with a trailing boundary, not as a substring: `&__save` occurs
  // inside `&__save-icon`, so a plain `toContain` passes even after the rule it
  // is meant to pin has been renamed away.
  const styles = read(FILES.styles);
  for (const selector of ["&__image", "&__title", "&__summary", "&__save"]) {
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
  // Absolute apart from stylesheets, for the reason recorded in 861 (D-105):
  // exempting `*.stories.*` hides the arm most likely to leave one behind.
  const shippedFiles = new Set([
    "MediaCardComponent.tsx",
    "media-card.scss",
    "media-card.schema.json",
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
  const runtime = await RUNTIME;

  expect(runtime.rendered).toBe(true);
  expect(existsSync(harness.reportFiles.toolchain)).toBe(true);
  expect(existsSync(harness.reportFiles.runtime)).toBe(true);
});
