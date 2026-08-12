/**
 * 842 — reuse, but as an edit rather than a blank page.
 *
 * 840 asks whether an agent building from nothing reaches for the library's
 * `Button` or writes a `<button>`. This asks the harder version: the
 * `<button>` already exists, it works, and it is styled well enough to pass a
 * glance. Deleting working code in favour of a dependency is a different
 * decision from choosing the dependency in the first place, and Phase 1 has no
 * evidence about it — every reuse observation in the campaign came from
 * greenfield tasks.
 *
 * The task is scoped tightly on purpose. The brief names the action and rules
 * the headline and copy out, so `Headline` and `Text` are available, obvious,
 * and *not* what was asked for. That makes overreach measurable: an agent that
 * migrates the whole tile has done more design-system-shaped work than the one
 * that did what was requested, and only one of them is right.
 *
 * The delegation is asserted against the rendered DOM, not the import list.
 * Importing `Button` and rendering a `<button>` next to it is a real failure
 * mode, and 861 established that reading source is not the same as checking
 * behaviour.
 *
 * What is deliberately *not* asserted: which `variant` or `size` is passed to
 * `Button`. The shipped styles suggest a bold, medium control, but that is a
 * judgement call and `ds-reuse` scores it.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/promo-tile",
  slug: "promo-tile",
  pascal: "PromoTile",
  renderProps: {
    headline: "Move your themes to the token layer",
    body: "The migration is opt-in and reversible for the whole of this release.",
    actionLabel: "Read the migration notes",
    actionIcon: "arrow-right",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  schema: shipped("src/components/promo-tile/promo-tile.schema.json"),
};

const RUNTIME = harness.writeRuntimeReport();
const html = async () => String((await RUNTIME).html ?? "");

/* ─────────────────────────── the swap happened ──────────────────────────── */

test("the action is the library's Button", async () => {
  // Checked in the output rather than the imports: importing `Button` and
  // rendering a `<button>` beside it is a failure this task exists to catch.
  const rendered = await html();
  expect(rendered).toContain("dsa-button");
  expect(rendered).toContain("dsa-button__label");
});

test("the hand-rolled control is gone", async () => {
  // Boundary-pinned: `dsa-promo-tile__action-icon` is a substring of
  // `dsa-promo-tile__action`, and a state that leaves only the icon behind
  // should fail the icon assertion, not this one.
  expect(read(FILES.component)).not.toMatch(/<button\b/);
  expect(await html()).not.toMatch(/dsa-promo-tile__action(?![\w-])/);
});

test("the icon is delegated too", async () => {
  // The tile hand-rolls the icon as well, and `Button` takes an `icon` prop.
  // Keeping the span and passing it as a child is the half-migration.
  const rendered = await html();
  expect(rendered).toContain("dsa-icon");
  expect(rendered).toMatch(/data-icon="arrow-right"/);
});

test("the styles that imitated a button are gone", async () => {
  // A dependency that leaves its replacement's stylesheet behind has not
  // reduced anything. `&__action`, `&__action-icon` and `&__action-label` all
  // existed only to look like the component now doing the work.
  const styles = read(FILES.styles);
  expect(styles).not.toMatch(/&__action(?![\w-])/);
  expect(styles).not.toMatch(/&__action-/);
});

test("the label still reaches the reader", async () => {
  expect(await html()).toContain("Read the migration notes");
});

/* ──────────────────────── and nothing else moved ────────────────────────── */

test("the API is unchanged", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("the headline and copy are left as they are", async () => {
  // Explicitly out of scope in the brief. `Headline` and `Text` are sitting
  // right there in the same import, which is the whole temptation.
  const source = read(FILES.component);
  expect(source).toMatch(/<h3\b/);
  expect(source).toContain("dsa-promo-tile__headline");
  expect(source).toContain("dsa-promo-tile__body");

  const rendered = await html();
  expect(rendered).not.toContain("dsa-headline");
  expect(rendered).not.toContain("dsa-text");
});

test("the tile keeps its own frame", () => {
  const styles = read(FILES.styles);
  for (const selector of ["&__headline", "&__body"]) {
    expect(styles).toMatch(new RegExp(`${selector}(?![\\w-])`));
  }
  expect(styles).toContain("--ks-spacing-inset-m");
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "@kickstartds/core",
    "@kickstartds/ds",
    "react",
    "react-dom",
  ]);
});

test("no unrelated files are added to the component", () => {
  // Absolute apart from stylesheets, for the reason recorded in 861 (D-105).
  const shippedFiles = new Set([
    "PromoTileComponent.tsx",
    "promo-tile.scss",
    "promo-tile.schema.json",
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
  expect(runtime.violations).toEqual([]);
  expect(existsSync(harness.reportFiles.toolchain)).toBe(true);
  expect(existsSync(harness.reportFiles.runtime)).toBe(true);
});
