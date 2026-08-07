/**
 * 810 — build an atom from a JSON Schema.
 *
 * The task-specific half of EVAL.ts. Everything structural (transcript capture,
 * typecheck, sass compile, jsdom render, axe) lives in the shared harness and
 * is bundled in by `bin/build-evals.ts` — edit the generated EVAL.ts and it
 * will be overwritten.
 *
 * This file lives outside `evals/` on purpose: everything in the fixture except
 * EVAL.ts and PROMPT.md is uploaded to the sandbox, so assertions kept next to
 * the fixture would be readable by the agent under test.
 */

import { existsSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/badge",
  slug: "badge",
  pascal: "Badge",
  renderProps: {
    label: "Badge label",
    variant: "informative",
    size: "medium",
    dismissible: true,
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
    "dismissible",
    "icon",
    "label",
    "size",
    "variant",
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

test("dismiss behaviour is implemented client-side, not in React", () => {
  // The contract puts interactivity in the vanilla-JS client file. An empty
  // stub next to an interactive React component would pass the existence check
  // above while violating the contract entirely.
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
