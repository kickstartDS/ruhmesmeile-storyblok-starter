/**
 * 816 — typography is a paired system, not four independent properties.
 *
 * The design-tokens server encodes a `typography-pairing` rule: the four type
 * categories (`display`, `copy`, `interface`, `mono`) each ship their own
 * family, size scale, line-height scale and text colour, and the scales are not
 * interchangeable. `--ks-line-height-display-*` is tight (1.15 base) because
 * display type is set large; `--ks-line-height-copy-*` is loose (1.5 base)
 * because copy is read in paragraphs. Pairing a display size with a copy
 * line-height is not a token error — every token involved is real, semantic and
 * correctly named — it is a *composition* error, and it is invisible to every
 * other token assertion in this suite.
 *
 * That is the whole point of the task. 811, 861 and 806 all grade "reach for a
 * semantic token instead of a literal", and this fixture passes all three of
 * those on the day it ships. What it fails is a rule that only exists inside
 * the design system's own documentation, which makes it a clean read on whether
 * the design-tokens server is being consulted for *intent* rather than for
 * autocomplete.
 *
 * The trap is degeneracy: setting every block to `font: var(--ks-font-copy-m)`
 * satisfies pairing perfectly and destroys the component. The three "still
 * reads as" pins exist solely to make that answer fail, and the brief says the
 * sizes are correct so the pins are not a hidden requirement.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/article-teaser",
  slug: "article-teaser",
  pascal: "ArticleTeaser",
  renderProps: {
    kicker: "Engineering",
    title: "What a design system owes its consumers",
    excerpt:
      "Every token you expose is a promise. Here is how we decide which ones to make.",
    readingTime: "6 min read",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  component: shipped(
    "src/components/article-teaser/ArticleTeaserComponent.tsx",
  ),
  schema: shipped("src/components/article-teaser/article-teaser.schema.json"),
};

/** The four typographic pieces of the card, and what each one is for. */
const ELEMENTS = ["kicker", "title", "excerpt", "reading-time"] as const;

/** Every `.scss` file in the component directory, concatenated. */
const allStyles = (): string =>
  readdirSync(harness.dir)
    .filter((name) => name.endsWith(".scss"))
    .map((name) => read(`${harness.dir}/${name}`))
    .join("\n");

/**
 * The declarations belonging to one element, brace-matched from its selector.
 *
 * Accepts both the nested `&__title` the fixture ships and a flattened
 * `.dsa-article-teaser__title`, because rewriting the stylesheet is allowed —
 * only the type inside it is being graded.
 */
const blockFor = (element: string): string => {
  const styles = allStyles();
  const selector = new RegExp(
    `(?:&|\\.dsa-article-teaser)__${element}(?![\\w-])`,
  );
  const found = selector.exec(styles);
  if (!found) return "";

  const open = styles.indexOf("{", found.index);
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
 * A block with one hop of component-token indirection folded in.
 *
 * Lifting the type into `--dsa-article-teaser--title-font` and defining it in
 * the token partial is the *more* idiomatic answer here, so the categories have
 * to be read through that layer rather than only off the rule itself.
 */
const expanded = (element: string): string => {
  const styles = allStyles();
  const block = blockFor(element);
  let text = block;

  for (const [, token] of block.matchAll(/var\(\s*(--dsa-[a-z0-9_-]+)/g)) {
    const definition = styles.match(
      new RegExp(`${token}\\s*:\\s*([^;]+);`),
    )?.[1];
    if (definition) text += `\n/* ${token} */ ${definition};`;
  }
  return text;
};

const CATEGORY = "(display|copy|interface|mono)";

/**
 * Which type categories and size tiers an element draws on.
 *
 * Reads the `font:` shorthand (`--ks-font-copy-m` bundles size, line-height and
 * family) and the split properties equally, because both are legitimate.
 */
const typeOf = (
  element: string,
): { categories: Set<string>; tiers: Set<string> } => {
  const text = expanded(element);
  const categories = new Set<string>();
  const tiers = new Set<string>();

  const collect = (pattern: RegExp, withTier: boolean) => {
    for (const match of text.matchAll(pattern)) {
      categories.add(match[1]);
      if (withTier && match[2]) tiers.add(match[2]);
    }
  };

  collect(new RegExp(`--ks-font-${CATEGORY}-([a-z]+)`, "g"), true);
  collect(new RegExp(`--ks-font-size-${CATEGORY}-([a-z]+)`, "g"), true);
  collect(new RegExp(`--ks-line-height-${CATEGORY}-([a-z]+)`, "g"), true);
  collect(new RegExp(`--ks-font-family-${CATEGORY}(?![a-z])`, "g"), false);

  return { categories, tiers };
};

/** The type category of a category-bound text colour, if the block sets one. */
const textColourOf = (element: string): string | undefined =>
  expanded(element).match(
    new RegExp(`--ks-text-color-(display|copy|interface)(?![a-z])`),
  )?.[1];

/* ─────────────────────────────── the fix ───────────────────────────────── */

test("each piece of type is set from a single category", () => {
  for (const element of ELEMENTS) {
    const { categories } = typeOf(element);
    expect(
      categories.size,
      `${element} mixes ${[...categories].sort().join(" + ")}`,
    ).toBeLessThanOrEqual(1);
  }
});

test("the text colours belong to the type they sit on", () => {
  for (const element of ELEMENTS) {
    const colour = textColourOf(element);
    if (!colour) continue;

    const { categories } = typeOf(element);
    if (categories.size !== 1) continue;

    expect(
      colour,
      `${element} is ${[...categories][0]} type coloured with ${colour}`,
    ).toBe([...categories][0]);
  }
});

test("nothing is pinned back down with hand-set values", () => {
  // The other way to make the line spacing "consistent" is to type a number.
  for (const element of ELEMENTS) {
    const text = expanded(element);
    expect(text, `${element} sets a raw line-height`).not.toMatch(
      /line-height\s*:\s*[\d.]/,
    );
    expect(text, `${element} sets a raw font-size`).not.toMatch(
      /font-size\s*:\s*[\d.]+(px|rem|em)/,
    );
  }
});

/* ─────────────────────── the scale survives the fix ─────────────────────── */

test("the title still reads as display type", () => {
  // Without this, `font: var(--ks-font-copy-m)` on all four blocks is a perfect
  // score for a component that has lost its hierarchy entirely.
  const { categories, tiers } = typeOf("title");
  expect([...categories]).toEqual(["display"]);
  expect([...tiers]).toContain("m");
});

test("the kicker and reading time still read as interface type", () => {
  for (const element of ["kicker", "reading-time"]) {
    const { categories, tiers } = typeOf(element);
    expect([...categories], element).toEqual(["interface"]);
    expect([...tiers], element).toContain("xs");
  }
});

test("the excerpt is left as the copy it already was", () => {
  const { categories, tiers } = typeOf("excerpt");
  expect([...categories]).toEqual(["copy"]);
  expect([...tiers]).toContain("m");
});

/* ──────────────────────────── nothing else moves ────────────────────────── */

test("the card's surface is left alone", () => {
  const styles = allStyles();
  for (const [token, value] of [
    ["--dsa-article-teaser--padding", "var(--ks-spacing-inset-l)"],
    ["--dsa-article-teaser--gap", "var(--ks-spacing-stack-s)"],
    ["--dsa-article-teaser--background", "var(--ks-background-color-card)"],
    ["--dsa-article-teaser--border-color", "var(--ks-border-color-default)"],
    ["--dsa-article-teaser--border-width", "var(--ks-border-width-default)"],
  ]) {
    expect(styles).toContain(`${token}: ${value};`);
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
  // Stylesheets exempt: routing the type through the token partial is a fine
  // way to do this. Everything else is absolute, per D-105.
  const shippedFiles = new Set([
    "ArticleTeaserComponent.tsx",
    "article-teaser.scss",
    "_article-teaser-tokens.scss",
    "article-teaser.schema.json",
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
