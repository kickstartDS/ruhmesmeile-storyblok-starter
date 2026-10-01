/**
 * The typography-pairing rule, as a pure function of stylesheet text.
 *
 * `816-typography-pairing` enforces this rule in its in-sandbox gate, and for a
 * long time nothing host-side did — two runs scored 0.9843 while one passed and
 * one failed, so the report showed two identical pages and `quality` was blind
 * to the one rule the task exists to test.
 *
 * The sandbox cannot import this module: `lib/eval-harness/sources/` is bundled
 * into a self-contained `EVAL.ts` and must not drag in host paths. So the rule
 * exists twice, deliberately, and `bin/graders-selftest.ts` pins them together
 * against the reference implementation — a divergence fails the selftest rather
 * than quietly grading differently from the gate.
 */

/** The four typographic pieces of the card, and what each one is for. */
export const PAIRING_ELEMENTS = [
  "kicker",
  "title",
  "excerpt",
  "reading-time",
] as const;

export type PairingElement = (typeof PAIRING_ELEMENTS)[number];

const CATEGORY = "(display|copy|interface|mono)";

/**
 * The declarations belonging to one element, brace-matched from its selector.
 *
 * Accepts both the nested `&__title` the fixture ships and a flattened
 * `.dsa-article-teaser__title`, because rewriting the stylesheet is allowed —
 * only the type inside it is being graded.
 */
export function elementBlock(
  styles: string,
  slug: string,
  element: string,
): string {
  const selector = new RegExp(`(?:&|\\.dsa-${slug})__${element}(?![\\w-])`);
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
}

/**
 * A block with one hop of component-token indirection folded in.
 *
 * Lifting the type into `--dsa-article-teaser--title-font` and defining it in
 * the token partial is the *more* idiomatic answer here, so the categories have
 * to be read through that layer rather than only off the rule itself.
 */
export function expandedBlock(
  styles: string,
  slug: string,
  element: string,
): string {
  const block = elementBlock(styles, slug, element);
  let text = block;

  for (const [, token] of block.matchAll(/var\(\s*(--dsa-[a-z0-9_-]+)/g)) {
    const definition = styles.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))?.[1];
    if (definition) text += `\n/* ${token} */ ${definition};`;
  }
  return text;
}

/**
 * Which type categories and size tiers a block draws on.
 *
 * Reads the `font:` shorthand (`--ks-font-copy-m` bundles size, line-height and
 * family) and the split properties equally, because both are legitimate.
 */
export function typeCategories(text: string): {
  categories: Set<string>;
  tiers: Set<string>;
} {
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
}

/** The type category of a category-bound text colour, if the block sets one. */
export function textColour(text: string): string | undefined {
  return text.match(new RegExp(`--ks-text-color-(display|copy|interface)(?![a-z])`))
    ?.[1];
}

/** Hand-set values that pin type back down instead of reaching for a token. */
export function handSetValues(text: string): string[] {
  const found: string[] = [];
  if (/line-height\s*:\s*[\d.]/.test(text)) found.push("line-height");
  if (/font-size\s*:\s*[\d.]+(px|rem|em)/.test(text)) found.push("font-size");
  return found;
}

export interface PairingCheck {
  id: string;
  label: string;
  passed: boolean;
  score: number;
  details?: string;
}

/**
 * The three assertions `816` gates on, evaluated host-side.
 *
 * Mirrors `lib/eval-harness/sources/816-typography-pairing.ts` test for test:
 * one category per element, a category-bound colour that matches it, and no
 * hand-set `line-height`/`font-size`.
 */
export function checkTypographyPairing({
  styles,
  slug,
  elements = PAIRING_ELEMENTS,
}: {
  styles: string;
  slug: string;
  elements?: readonly string[];
}): PairingCheck[] {
  const blocks = new Map(
    elements.map((element) => [element, expandedBlock(styles, slug, element)]),
  );

  const mixed = elements
    .map((element) => ({
      element,
      categories: [...typeCategories(blocks.get(element) ?? "").categories],
    }))
    .filter((entry) => entry.categories.length > 1);
  const singleCategory: PairingCheck = {
    id: "single-category",
    label: "each piece of type is set from a single category",
    passed: mixed.length === 0,
    score: mixed.length === 0 ? 1 : 0,
    details: mixed.length
      ? mixed
          .map((entry) => `${entry.element} mixes ${entry.categories.sort().join(" + ")}`)
          .join("; ")
      : undefined,
  };

  const mismatched = elements
    .map((element) => {
      const text = blocks.get(element) ?? "";
      const { categories } = typeCategories(text);
      return { element, category: [...categories][0] ?? null, size: categories.size, colour: textColour(text) };
    })
    .filter(
      (entry) => entry.size === 1 && entry.colour && entry.colour !== entry.category,
    );
  const colourMatches: PairingCheck = {
    id: "colour-matches-type",
    label: "the text colours belong to the type they sit on",
    passed: mismatched.length === 0,
    score: mismatched.length === 0 ? 1 : 0,
    details: mismatched.length
      ? mismatched
          .map(
            (entry) =>
              `${entry.element} is ${entry.category} type coloured with ${entry.colour}`,
          )
          .join("; ")
      : undefined,
  };

  const handSet = elements
    .map((element) => ({ element, values: handSetValues(blocks.get(element) ?? "") }))
    .filter((entry) => entry.values.length);
  const nothingPinned: PairingCheck = {
    id: "no-hand-set-values",
    label: "nothing is pinned back down with hand-set values",
    passed: handSet.length === 0,
    score: handSet.length === 0 ? 1 : 0,
    details: handSet.length
      ? handSet.map((entry) => `${entry.element}: ${entry.values.join(", ")}`).join("; ")
      : undefined,
  };

  return [singleCategory, colourMatches, nothingPinned];
}
