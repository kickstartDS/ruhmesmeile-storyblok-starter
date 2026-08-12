/**
 * 814 — design the API, then build to it.
 *
 * The counterpart to 810. There the schema was handed over and the only
 * question was whether the agent could implement it; here the brief describes
 * behaviour and ships no schema, so the public surface is the agent's own.
 *
 * This exists because `api-design` had nothing to judge. Across the whole suite
 * every schema was authored by the fixture, so once the judge was correctly
 * stopped from grading files the agent had not written, the rubric had no
 * material and disabled itself (D-102). A rubric that measures a decision needs
 * a task where that decision is actually taken.
 *
 * The assertions here are deliberately thin. The brief fixes exactly one thing
 * about the shape — steps arrive as `steps`, each with a label — because the
 * runtime and a11y checks have to be able to render the component without
 * knowing its API, and because a brief that names the data it must display is
 * what a real one does. Everything else is left open on purpose: whether step
 * state is an enum or a scatter of booleans, whether the current step is an
 * index or a flag on the item, what is required versus defaulted. Those are the
 * decisions the judge is there to read, and asserting them here would both
 * pre-empt it and quietly turn the task back into 810.
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
  dir: "src/components/progress-steps",
  slug: "progress-steps",
  pascal: "ProgressSteps",
  // Only what the brief guarantees. The component has to stand up on this
  // alone, which is itself the requirement that a prop with no sensible
  // default is a design flaw.
  renderProps: {
    steps: [
      { label: "Basket" },
      { label: "Delivery" },
      { label: "Payment" },
      { label: "Confirmation" },
    ],
  },
});

const { files: FILES, read, toolchainReport } = harness;

test("component file follows the {Name}Component.tsx contract", () => {
  expect(existsSync(FILES.component)).toBe(true);
});

test("styles file follows the {slug}.scss contract", () => {
  expect(existsSync(FILES.styles)).toBe(true);
});

test("the component's API is declared in a schema", () => {
  expect(existsSync(FILES.schema)).toBe(true);
});

test("the schema is a usable object schema", () => {
  const schema = JSON.parse(read(FILES.schema));
  expect(schema.type).toBe("object");
  expect(schema.properties).toBeTypeOf("object");
  expect(Object.keys(schema.properties).length).toBeGreaterThan(0);
});

test("the schema declares the steps the brief specified", () => {
  const schema = JSON.parse(read(FILES.schema));
  // The one part of the shape the brief pins down. How each step is described
  // beyond carrying a label is the agent's decision and is not asserted.
  expect(Object.keys(schema.properties)).toContain("steps");
  expect(schema.properties.steps.type).toBe("array");
});

test("nothing beyond the steps is required to render", () => {
  // The brief asks for a component that works given only the steps. A schema
  // that demands more contradicts the implementation the runtime check renders,
  // and the mismatch is worth failing loudly rather than discovering as a
  // confusing render error.
  const schema = JSON.parse(read(FILES.schema));
  expect(schema.required ?? []).toEqual(
    (schema.required ?? []).filter((name: string) => name === "steps"),
  );
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
