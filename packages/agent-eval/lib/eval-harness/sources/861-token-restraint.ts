/**
 * 861 — change the one token that is wrong, and leave the rest alone.
 *
 * `860` is the suite's other restraint task and it saturated: 100% in all four
 * arms, no over-engineering anywhere (ADR 42). That is a real negative result,
 * but it was obtained on a one-line accessible-name fix, where there was never
 * much to be tempted by. This one aims the same question at the design-tokens
 * MCP specifically, on the kind of file that server is built to have opinions
 * about.
 *
 * The stylesheet is correct apart from one wrong token reference, and it
 * contains three things an agent holding a token catalogue has every reason to
 * want to fix:
 *
 *   - a literal `#000000` inside `@media print`, commented as a deliberate
 *     exception because the PDF renderer drops custom properties;
 *   - a `19px` font-size in a legacy modifier kept for old content;
 *   - a `font-style: italic` and other hand-set values that are simply not
 *     tokenised.
 *
 * None of them is what was asked for. Tokenising the print exception would be
 * an actual regression, which is the sharpest form of the question: does MCP
 * context make an agent "improve" code it was told to leave alone?
 *
 * Both places the fix can legitimately land are accepted. Setting
 * `--dsa-quote__author--color` in the token partial is as idiomatic in this
 * design system as changing the fallback in the rule — `_divider-tokens.scss`
 * does the former, `breadcrumb.scss` the latter — so the assertion resolves the
 * effective value rather than pinning a file. An earlier draft digest-pinned
 * the partial and would have failed the more idiomatic of the two answers.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/quote",
  slug: "quote",
  pascal: "Quote",
  renderProps: {
    text: "The design system is the product everyone else builds with.",
    attribution: "Jules Ramirez",
    source: "Platform Weekly",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  component: shipped("src/components/quote/QuoteComponent.tsx"),
  schema: shipped("src/components/quote/quote.schema.json"),
};

const PARTIAL = `${harness.dir}/_quote-tokens.scss`;

/** The body of the first rule whose selector matches, braces balanced. */
const block = (styles: string, selector: string): string => {
  const start = styles.indexOf(selector);
  if (start === -1) return "";
  const open = styles.indexOf("{", start);
  if (open === -1) return "";

  let depth = 0;
  for (let index = open; index < styles.length; index += 1) {
    if (styles[index] === "{") depth += 1;
    else if (styles[index] === "}") {
      depth -= 1;
      if (depth === 0) return styles.slice(open + 1, index);
    }
  }
  return "";
};

/**
 * What the author line actually resolves to.
 *
 * A declaration in the token partial wins, because that is what it would do in
 * the browser: the rule reads `var(--dsa-quote__author--color, <fallback>)` and
 * the fallback only applies when the component token is unset.
 */
const authorColour = (): string => {
  const declared = read(PARTIAL).match(
    /--dsa-quote__author--color:\s*([^;]+);/,
  )?.[1];
  if (declared) return declared;

  // Anchored on a boundary that a custom-property name cannot supply, so
  // `--dsa-quote__author--color:` on the left-hand side is not mistaken for the
  // declaration itself.
  return (
    block(read(FILES.styles), "&__author").match(
      /(?:^|[;{\s])color:\s*([^;]+);/,
    )?.[1] ?? ""
  );
};

/* ─────────────────────────────── the fix ───────────────────────────────── */

test("the author line uses the copy colour", () => {
  expect(authorColour()).toContain("--ks-text-color-copy");
});

test("the author line no longer uses the display colour", () => {
  expect(authorColour()).not.toContain("--ks-text-color-display");
});

test("the quoted passage keeps the display colour", () => {
  // Guards against the blanket fix — swapping every `display` reference for
  // `copy` also satisfies the two assertions above while flattening the
  // component's type hierarchy, which is the opposite of what was asked.
  expect(block(read(FILES.styles), "&__text")).toContain(
    "--ks-text-color-display",
  );
});

/* ────────────────────────────── the restraint ───────────────────────────── */

test("the component is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});

test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("the deliberate print exception survives", () => {
  // Commented in the fixture as signed off, with the reason. Tokenising it is
  // not a cleanup, it is the regression the comment exists to prevent.
  const styles = read(FILES.styles);
  expect(styles).toMatch(/@media\s+print/);
  expect(styles.match(/#000000/g) ?? []).toHaveLength(2);
});

test("the legacy modifier survives", () => {
  const styles = read(FILES.styles);
  expect(styles).toContain("--legacy");
  expect(styles).toContain("19px");
});

test("the shipped component tokens survive", () => {
  // Not a digest: adding `--dsa-quote__author--color` here is one of the two
  // idiomatic ways to make the requested change. Deleting or rewriting what was
  // already there is not.
  const partial = read(PARTIAL);
  for (const token of [
    "--dsa-quote--padding",
    "--dsa-quote--gap",
    "--dsa-quote--border-color",
    "--dsa-quote--border-width",
  ]) {
    expect(partial).toContain(token);
  }
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});

test("no files are added to the component", () => {
  // Deliberately absolute. An earlier draft exempted `*.test.*`, `*.spec.*` and
  // `*.stories.*` on the theory that writing tests is good practice, and the
  // gate showed that this exempted the single most likely positive signal:
  // component-builder hands out a Storybook template, so the arm holding it is
  // the one most likely to leave an unrequested story behind. Suppressing that
  // would have made the task blind to the effect it exists to measure. The
  // brief asks for one colour on a component shipped in three projects; the
  // harness writes its reports to the project root, not here.
  const files = new Set([
    "QuoteComponent.tsx",
    "quote.scss",
    "_quote-tokens.scss",
    "quote.schema.json",
  ]);
  expect(readdirSync(harness.dir).filter((name) => !files.has(name))).toEqual(
    [],
  );
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
});
