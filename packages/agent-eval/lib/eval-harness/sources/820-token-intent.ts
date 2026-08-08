/**
 * 820 — pick the right token, when every name is already in front of you.
 *
 * Why this task exists: the fixtures now ship the `--ks-*` layer (D-89), which
 * makes every valid token name greppable from inside the sandbox. That is more
 * honest — the real repository has the layer — but it also hands the baseline
 * arm the one thing the Design Tokens MCP was measurably supplying. Knowing the
 * names *is* what `token-conformance`'s `known-tokens` check rewards, and it is
 * the check that moved in every task of the first campaign. Left alone, the
 * arm comparison would have quietly become a comparison of nothing (D-91).
 *
 * So this task is built on what survives the layer being visible: the design
 * system's encoded *rules*, which the names do not reveal. All three defects
 * below are spelled with real, existing, greppable tokens, and all three are
 * still wrong:
 *
 *   - `color-semantic-layer` (warning) — components consume `--ks-text-color-*`
 *     and friends. `--ks-color-primary` is a primitive, meant for *building*
 *     the semantic layer, not for use in a component. Nothing about the name
 *     says so.
 *   - `typography-pairing` (warning) — font-size, line-height and font-family
 *     are organised into categories (display / copy / interface / mono).
 *     `--ks-font-size-display-l` with `--ks-line-height-copy-l` is two valid
 *     tokens and a broken vertical rhythm, because display line-heights are
 *     tight (1.15) and copy line-heights are wide (1.5).
 *   - `font-family-roles` (warning) — the same categories govern which family
 *     belongs on which text.
 *
 * These are `mcp_design_system2_get_design_rules` rules, served by the tokens
 * MCP. An agent with the server can ask. An agent without it has 1,522 valid
 * names, no indication that they form families, and has to know the system.
 *
 * The stylesheet ships fully tokenised and wrong, so nothing here re-tests 812:
 * there is not a single literal to replace, and replacing one would fail.
 *
 * The component and its schema ship complete and correct. See
 * lib/eval-harness/sources/ for why this file is not in the fixture.
 */

import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/stat",
  slug: "stat",
  pascal: "Stat",
  renderProps: {
    value: "48,120",
    label: "Monthly active users",
    delta: "+12.4%",
    trend: "up",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  component: shipped("src/components/stat/StatComponent.tsx"),
  schema: shipped("src/components/stat/stat.schema.json"),
};

test("the component file is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});

test("the provided schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

/* ─────────────────────────── the semantic layer ─────────────────────────── */

/**
 * `--ks-color-*` is the primitive palette.
 *
 * Matched with a boundary on the left so the semantic families that merely
 * *contain* the word — `--ks-background-color-*`, `--ks-text-color-*`,
 * `--ks-border-color-*` — are not swept up with it.
 */
function primitiveColourRefs(css: string): string[] {
  return [...new Set(css.match(/--ks-color-[a-zA-Z0-9-]+/g) ?? [])];
}

test("colours come from the semantic layer, not the primitive palette", () => {
  expect(primitiveColourRefs(read(FILES.styles))).toEqual([]);
});

/* ──────────────────────── typography category pairing ───────────────────── */

const CATEGORIES = ["display", "copy", "interface", "mono"] as const;
type Category = (typeof CATEGORIES)[number];

/** The category a `--ks-font-*` / `--ks-line-height-*` / `--ks-text-color-*` token belongs to. */
function categoryOf(token: string): Category | null {
  for (const category of CATEGORIES) {
    if (
      token.startsWith(`--ks-font-size-${category}`) ||
      token.startsWith(`--ks-line-height-${category}`) ||
      token === `--ks-font-family-${category}` ||
      token === `--ks-text-color-${category}`
    ) {
      return category;
    }
  }
  return null;
}

/**
 * Splits a stylesheet into `{ selector, body }` blocks.
 *
 * The fixture is flat CSS-in-SCSS and the task forbids restructuring the
 * markup, but an agent may legitimately nest with `&`. Braces are matched by
 * depth so a nested block is read as its own block rather than silently folded
 * into its parent, which would let a genuine category mix hide.
 */
function blocks(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const source = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("{", index);
    if (open === -1) break;

    const selector = source.slice(index, open).split(/[;}]/).pop()!.trim();

    let depth = 1;
    let cursor = open + 1;
    let body = "";
    while (cursor < source.length && depth > 0) {
      const char = source[cursor]!;
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      if (depth > 0) body += char;
      cursor += 1;
    }

    // Only the declarations directly in this block; nested blocks are visited
    // on their own by the outer loop.
    out.push({ selector, body: body.replace(/[^{}]*\{[\s\S]*?\}/g, "") });
    index = open + 1;
  }

  return out;
}

/** Every `--ks-*` token referenced by a given property inside a block. */
function tokensFor(body: string, property: string): string[] {
  const found: string[] = [];
  const pattern = new RegExp(`${property}\\s*:([^;]*)`, "g");
  for (const match of body.matchAll(pattern)) {
    found.push(...(match[1]!.match(/--ks-[a-zA-Z0-9-]+/g) ?? []));
  }
  return found;
}

/**
 * Category mixes, as `selector: property=category` strings.
 *
 * A block that sets a font-size of one category and a line-height, font-family
 * or category-bound text-color of another is reported. A block that sets only
 * one of them is not: inheriting the rest from a parent is normal CSS and not
 * this rule's business. Tokens outside the four categories — `--ks-spacing-*`,
 * `--ks-text-color-positive` — have no category and are never reported.
 */
function categoryMixes(css: string): string[] {
  const mixes: string[] = [];

  for (const { selector, body } of blocks(css)) {
    const sizes = tokensFor(body, "font-size").map(categoryOf).filter(Boolean);
    if (!sizes.length) continue;

    const expected = sizes[0] as Category;
    const partners = [
      ...tokensFor(body, "line-height"),
      ...tokensFor(body, "font-family"),
      ...tokensFor(body, "color"),
    ];

    for (const token of partners) {
      const category = categoryOf(token);
      if (category && category !== expected) {
        mixes.push(`${selector} — ${expected} font-size with ${token}`);
      }
    }
  }

  return mixes;
}

test("typography tokens are not mixed across categories", () => {
  expect(categoryMixes(read(FILES.styles))).toEqual([]);
});

/* ──────────────────────────── not by deletion ───────────────────────────── */

/**
 * Every assertion above passes on an empty file, so the work has to be shown to
 * still be there. Without this, deleting the awkward declarations is a perfect
 * score — the loophole state of D-68.
 */
test("the stylesheet still styles the component", () => {
  const styles = read(FILES.styles);

  expect(tokensFor(styles, "font-size").length).toBeGreaterThanOrEqual(3);
  expect(tokensFor(styles, "line-height").length).toBeGreaterThanOrEqual(3);
  expect(tokensFor(styles, "color").length).toBeGreaterThanOrEqual(3);
});

test("the two trends stay tokenised and distinct from one another", () => {
  const styles = read(FILES.styles);
  const up = blocks(styles).find((block) => block.selector.includes("--up"));
  const down = blocks(styles).find((block) =>
    block.selector.includes("--down"),
  );

  expect(up, "no rule for the up trend").toBeTruthy();
  expect(down, "no rule for the down trend").toBeTruthy();

  const upColour = tokensFor(up!.body, "color");
  const downColour = tokensFor(down!.body, "color");

  expect(upColour.length).toBeGreaterThan(0);
  expect(downColour.length).toBeGreaterThan(0);
  expect(upColour).not.toEqual(downColour);
});

test("no literal values are introduced", () => {
  const styles = read(FILES.styles).replace(/^\s*\/\/.*$/gm, "");
  const literals = [
    ...(styles.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
    ...(styles.match(/\b(?:rgba?|hsla?)\(/g) ?? []),
    ...(styles.match(
      /(?:font-size|line-height)\s*:[^;]*\b\d+(?:\.\d+)?(?:px|rem|em)?\s*;/g,
    ) ?? []),
  ];
  expect(literals).toEqual([]);
});

/* ────────────────────────────── still healthy ───────────────────────────── */

test("the package typechecks", () => {
  expect(toolchainReport.typecheck.detail).toBe("");
});

test("the stylesheet compiles", () => {
  expect(toolchainReport.styles.detail).toBe("");
});
