/**
 * 832 — interactive behaviour without React state.
 *
 * Two dimensions came out of the 4-variant matrix unexplained. `purity` sat at
 * exactly 0.75 in every MCP run — the servers do not stop agents reaching for
 * useState — and `client-behaviour` swung between 0.00 and 1.00 inside a single
 * arm, which is the signature of a task that only incidentally exercises it.
 * 810 asks for a dismissible badge, where the behaviour is one line and easy to
 * fake with a stub. A disclosure cannot be faked: the trigger, the panel and
 * the ARIA relationship between them all have to be wired up in vanilla JS.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/disclosure",
  slug: "disclosure",
  pascal: "Disclosure",
  renderProps: {
    summary: "What is covered by the warranty?",
    content: "Manufacturing defects for 24 months from the date of purchase.",
    id: "warranty",
    // Rendered open so that the initial-state assertion below has something to
    // observe, and so the a11y probe sees the expanded panel rather than a
    // hidden subtree it would skip.
    defaultOpen: true,
  },
});

const { files: FILES, clientFile, read, toolchainReport } = harness;

test("component file follows the {Name}Component.tsx contract", () => {
  expect(existsSync(FILES.component)).toBe(true);
});

test("styles file follows the {slug}.scss contract", () => {
  expect(existsSync(FILES.styles)).toBe(true);
});

test("client behaviour file follows the {Name}.client.js contract", () => {
  expect(clientFile()).toBeDefined();
});

test("the provided schema is left untouched", () => {
  const schema = JSON.parse(read(FILES.schema));
  expect(Object.keys(schema.properties).sort()).toEqual([
    "content",
    "defaultOpen",
    "id",
    "summary",
  ]);
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

test("the trigger is a real button", () => {
  // Keyboard operability, focus handling and Enter/Space activation all come
  // free from a <button>. A div with a click handler has to reimplement each of
  // them, and usually reimplements none.
  expect(read(FILES.component)).toMatch(/<button[\s>]/);
});

test("expanded state is exposed to assistive technology", () => {
  const source = read(FILES.component);
  expect(source).toMatch(/aria-expanded/);
  expect(source).toMatch(/aria-controls/);
});

test("the initial state is rendered server-side, not applied on hydration", async () => {
  // `defaultOpen` has to reach the markup. If the panel is always rendered
  // closed and the client file opens it on load, every default-open disclosure
  // flashes shut on first paint.
  //
  // Asserted against rendered output rather than source text: the prop name
  // appears in the destructuring of any component that merely declares it, so
  // matching /defaultOpen/ in the source also passed implementations that
  // accepted the prop and then ignored it.
  const report = await harness.writeRuntimeReport();
  expect(report.rendered).toBe(true);
  expect(String(report.html)).toMatch(/aria-expanded="true"/);
});

test("toggling is implemented client-side, not in React", () => {
  const path = clientFile();
  expect(path).toBeDefined();
  const client = read(path!);
  expect(client.trim().length).toBeGreaterThan(0);
  expect(client).toMatch(/addEventListener/);
  // The behaviour under test: the trigger's ARIA state has to actually change.
  expect(client).toMatch(/aria-expanded/);
});

test("the client file is framework-free vanilla JavaScript", () => {
  const client = read(clientFile()!);
  expect(client).not.toMatch(/\bfrom\s+["']react["']/);
  expect(client).not.toMatch(/\buseState\b/);
});

test("styles use design tokens rather than literal colour values", () => {
  const styles = read(FILES.styles);
  const literals = styles.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g) ?? [];
  expect(literals).toEqual([]);
  expect(styles).toMatch(/var\(--/);
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
