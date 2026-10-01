/**
 * 891 — build a comparison table whose recommended column is one inverted band.
 *
 * Written from scratch against a schema that is handed to the agent, like 890,
 * and it tests the same three design-system facts on a component with more
 * parts and a harder one of its own:
 *
 *   - the band is inverted per cell, by putting `ks-inverted` on every cell of
 *     that column and letting the semantic tokens flip underneath them;
 *   - those cells are what makes this task different from 890. A custom
 *     property is substituted where it is *declared*, so a band colour declared
 *     on the block resolves against the light page and inherits its light value
 *     into the dark column — dark text on a dark surface. The declaration has
 *     to be one the cells themselves match. That is asserted by matching the
 *     stylesheet's selectors against the rendered cells, so it does not depend
 *     on what the agent called anything;
 *   - an icon that carries the meaning has to reach a screen reader as well, so
 *     a cell with an icon and a text carries both.
 *
 * What is deliberately not asserted: which tokens are chosen, how the hairlines
 * are drawn, and how the column is rounded. The contract graders and the
 * rubrics score those.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const requireCjs = createRequire(import.meta.url);

/** The rows the gate renders with, so it knows what each cell should hold. */
const FEATURE_ROWS: Array<{
  label: string;
  value: Array<{ text?: string; icon?: string }>;
}> = [
  {
    label: "Number of projects",
    value: [{ text: "01" }, { text: "10" }, { text: "Unlimited" }],
  },
  {
    label: "Custom domain",
    value: [
      { icon: "close", text: "Not included" },
      { icon: "check", text: "Included" },
      { icon: "check", text: "Included" },
    ],
  },
  {
    label: "Component contracts",
    value: [{}, { icon: "check", text: "Included" }, {}],
  },
];

const harness = createHarness({
  dir: "src/components/comparison-table",
  slug: "comparison-table",
  pascal: "ComparisonTable",
  renderProps: {
    plans: [
      {
        name: "Basic",
        price: "$99",
        pricePeriod: "Per month",
        cta: { url: "#", label: "Get Started" },
      },
      {
        name: "Premium",
        price: "$199",
        pricePeriod: "Per month",
        badge: "Popular",
        highlight: true,
        cta: { url: "#", label: "Get Started" },
      },
      {
        name: "Enterprise",
        price: "$399",
        pricePeriod: "Per month",
        cta: { url: "#", label: "Get Started" },
      },
    ],
    featureRow: FEATURE_ROWS,
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  schema: shipped("src/components/comparison-table/comparison-table.schema.json"),
};

const PLAN_COUNT = 3;
const HIGHLIGHTED_COLUMN = 1;

/* ─────────────────────────── reading the styles ─────────────────────────── */

/**
 * Declarations that set a colour, including the component tokens that carry
 * one — `--dsa-pricing-plan--background-color: var(--ks-…)` is a colour
 * declaration, and reading it is the difference between counting one semantic
 * token and counting the twelve a component actually reaches for.
 */
const COLOUR_DECLARATION =
  /(?:^|[;{\n])\s*(--[a-z0-9_-]*(?:color|background|border|shadow|fill|stroke)[a-z0-9_-]*|color|background|background-color|background-image|border|border-color|border-[a-z-]*color|fill|stroke|outline|outline-color|box-shadow)\s*:\s*([^;]+);/gm;

const LITERAL_COLOUR =
  /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(|\b(white|black|silver|gray|grey|red|blue|green|navy|teal|maroon|purple|orange|yellow|pink|brown|lime|aqua|fuchsia)\b/i;

/** Every stylesheet in the component directory, concatenated. */
function allStyles(): string {
  if (!existsSync(harness.dir)) return "";
  return readdirSync(harness.dir)
    .filter((name) => name.endsWith(".scss") || name.endsWith(".css"))
    .map((name) => read(harness.dir + "/" + name))
    .join("\n");
}

/** Property/value pairs for declarations that set a colour. */
export function colourDeclarations(styles: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const match of styles.matchAll(COLOUR_DECLARATION)) {
    out.push([match[1].trim(), match[2].trim()]);
  }
  return out;
}

/** Colour values that are not a token. */
export function literalColours(styles: string): string[] {
  return colourDeclarations(styles)
    .map(([, value]) => value)
    .filter((value) => !/^var\(--/.test(value))
    .filter((value) => LITERAL_COLOUR.test(value));
}

/** The design system's own inversion, re-implemented inside a component. */
export function reimplementsInversion(styles: string): boolean {
  return (
    /\[ks-inverted/.test(styles) ||
    /prefers-color-scheme/.test(styles) ||
    /\[data-theme/.test(styles)
  );
}

/** Distinct semantic colour tokens the stylesheet reaches for. */
export function semanticColourTokens(styles: string): string[] {
  const found = new Set<string>();
  for (const [, value] of colourDeclarations(styles)) {
    for (const match of value.matchAll(/var\((--ks-[a-z0-9-]+)/g)) {
      found.add(match[1]);
    }
  }
  return [...found];
}

/* ───────────────────────── reading the compiled CSS ─────────────────────── */

export interface CssRule {
  selector: string;
  body: string;
}

/** Selector/declaration pairs out of compiled CSS. See 890 for the reasoning. */
export function cssRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selector: match[1].trim(), body: match[2].trim() });
  }
  return rules;
}

/** Files written into the component directory, whatever they are called. */
export function writtenComponent(dir: string): {
  component: boolean;
  styles: boolean;
} {
  if (!existsSync(dir)) return { component: false, styles: false };
  const names = readdirSync(dir);
  return {
    component: names.some(
      (name) =>
        /\.(tsx|jsx)$/.test(name) && !/\.(test|spec|stories)\./.test(name),
    ),
    styles: names.some(
      (name) => /\.(scss|css)$/.test(name) && !name.startsWith("_"),
    ),
  };
}

/**
 * Whether a region is coloured by the inverted layer.
 *
 * Two routes reach it and the design system uses both: marking the region with
 * `ks-inverted`, or reaching for the `-inverted` variant of each semantic token.
 * `section.scss` takes the second one for its own inverted background, and
 * either satisfies "inverted relative to its surroundings". What fails is a
 * colour scheme of the component's own.
 */
export function usesInvertedTokens(region: Element, rules: CssRule[]): boolean {
  const invertedComponents = new Set<string>();
  for (const { body } of rules) {
    for (const match of body.matchAll(
      /(--[a-z0-9_-]+)\s*:\s*var\((--ks-[a-z0-9-]*inverted[a-z0-9-]*)\b/g,
    )) {
      invertedComponents.add(match[1]);
    }
  }

  for (const element of [region, ...region.querySelectorAll("*")]) {
    for (const rule of rules) {
      if (!matchesAny(element, [rule.selector])) continue;
      for (const declaration of rule.body.matchAll(
        /(?:background(-color|-image)?|color|border-[a-z-]*color|fill)\s*:\s*([^;]+)/g,
      )) {
        const value = declaration[2];
        if (/var\(--ks-[a-z0-9-]*inverted/.test(value)) return true;
        for (const token of value.matchAll(/var\((--[a-z0-9_-]+)/g)) {
          if (invertedComponents.has(token[1])) return true;
        }
      }
    }
  }

  return false;
}

/** The element part of a selector that carries a pseudo-element. */
export function hostOf(selector: string): string {
  return selector.replace(/::(?:before|after)\b/g, "").trim();
}

export function matchesAny(element: Element, selectors: string[]): boolean {
  return selectors.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      // A selector jsdom cannot evaluate is not evidence of anything.
      return false;
    }
  });
}

/* ────────────────────────── reading the render ──────────────────────────── */

async function rendered(): Promise<Element | null> {
  const report = await harness.runtimeReport();
  const html = typeof report.html === "string" ? report.html : "";
  if (!html) return null;
  const { JSDOM } = requireCjs("jsdom");
  const dom = new JSDOM(`<!doctype html><body><div id="r">${html}</div></body>`);
  return dom.window.document.getElementById("r");
}

/** The compiled stylesheet, or "" when it does not compile. */
function compiled(): string {
  if (!existsSync(FILES.styles)) return "";
  try {
    return requireCjs("sass").compile(FILES.styles, {
      loadPaths: [harness.dir, "src"],
    }).css;
  } catch {
    return "";
  }
}

/* ─────────── where a colour token has to be declared to be right ────────── */

const COMPONENT_TOKEN = /--dsa-[a-z0-9_-]+/g;

/**
 * Component tokens that colour an inverted region but are declared outside it.
 *
 * A custom property is substituted where it is declared. A token declared on an
 * ancestor of the inverted element resolves against whatever context that
 * ancestor is in — the light page — and every element inside the inverted
 * region inherits that frozen value. So a component token that colours anything
 * inside the region has to be declared by a selector matching an element inside
 * the region, and this returns the ones that are not, as descriptions.
 */
export function tokensDeclaredOutside(
  inverted: Element[],
  rules: CssRule[],
): string[] {
  const offenders: string[] = [];

  for (const region of inverted) {
    const inside = [region, ...region.querySelectorAll("*")];
    const consumed = new Set<string>();

    for (const element of inside) {
      for (const rule of rules) {
        if (!matchesAny(element, [rule.selector])) continue;
        for (const match of rule.body.matchAll(
          /(?:background(-color|-image)?|border-[a-z-]*color|color)\s*:\s*[^;]*?var\((--dsa-[a-z0-9_-]+)/g,
        )) {
          consumed.add(match[2]);
        }
      }
    }

    for (const token of consumed) {
      const declaring = rules
        .filter((rule) => rule.body.includes(`${token}:`))
        .map((rule) => hostOf(rule.selector));
      const declaredInside = declaring.some((selector) =>
        inside.some((element) => matchesAny(element, [selector])),
      );
      if (!declaredInside) {
        offenders.push(
          `${token} is used inside the inverted region but declared by ${declaring.join(" | ") || "nothing"}`,
        );
      }
    }
  }

  return offenders;
}

/* ────────────────────────────── the contract ────────────────────────────── */

test("a component and a stylesheet are written into the component directory", () => {
  // Whatever they are called. Naming is `component-contract`'s job, and the
  // harness renders by discovery for the same reason.
  expect(existsSync(FILES.schema)).toBe(true);
  const written = writtenComponent(harness.dir);
  expect(written.component).toBe(true);
  expect(written.styles).toBe(true);
});

test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("no colour is written as a literal", () => {
  expect(literalColours(allStyles())).toEqual([]);
});

test("the inversion is not reimplemented in the component", () => {
  expect(reimplementsInversion(allStyles())).toBe(false);
});

test("colours come from the token system", () => {
  expect(semanticColourTokens(allStyles()).length).toBeGreaterThanOrEqual(3);
});

/* ────────────────────── what the render has to show ─────────────────────── */

test("the features are rows and the plans are columns", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();

  const table = root!.querySelector("table");
  expect(table).not.toBeNull();

  const columnHeaders = [...root!.querySelectorAll('th[scope="col"]')];
  const rowHeaders = [...root!.querySelectorAll('th[scope="row"]')];
  expect(columnHeaders.length).toBe(PLAN_COUNT);
  expect(rowHeaders.length).toBe(FEATURE_ROWS.length);
});

test("the recommended column is inverted, cell by cell", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();

  const rules = cssRules(compiled());

  // The band is found by structure rather than by what the solution called it:
  // the cells of the recommended plan's column, header to call to action.
  const band = [...root!.querySelectorAll("tr")]
    .map((row) => [...row.children][HIGHLIGHTED_COLUMN + 1])
    .filter((cell): cell is Element => Boolean(cell));
  expect(band.length).toBeGreaterThan(1);

  const marked = band.filter(
    (cell) => cell.getAttribute("ks-inverted") === "true",
  );
  const tokenised = band.filter((cell) => usesInvertedTokens(cell, rules));

  if (marked.length === band.length) {
    // Nothing outside the band may be marked either, or the inversion has been
    // sprayed over the table rather than applied to the column.
    expect(root!.querySelectorAll('[ks-inverted="true"]').length).toBe(
      band.length,
    );
    return;
  }

  // The other route: every cell of the band coloured by the inverted layer.
  expect(
    tokenised.length,
    `band cells: ${band.length}, marked: ${marked.length}, inverted tokens: ${tokenised.length}`,
  ).toBe(band.length);
});

test("every cell holds what the schema says it holds", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();

  const bodyRows = [...root!.querySelectorAll("tbody tr")];
  expect(bodyRows.length).toBe(FEATURE_ROWS.length);

  bodyRows.forEach((row, rowIndex) => {
    const cells = [...row.children].slice(1);
    expect(cells.length).toBe(PLAN_COUNT);

    FEATURE_ROWS[rowIndex].value.forEach((value, columnIndex) => {
      const cell = cells[columnIndex];
      const html = cell.outerHTML;

      if (value.icon) {
        expect(html).toContain(`data-icon="${value.icon}"`);
      }
      if (value.text) {
        // The text is there either as the value or as the label for the icon.
        expect(cell.textContent).toContain(value.text);
      }
      if (!value.icon && !value.text) {
        expect(html).not.toMatch(/data-icon="/);
        expect(cell.textContent?.trim() ?? "").not.toContain("Included");
      }
    });
  });
});

test("the column's colours are declared where the inversion applies", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();

  const inverted = [...root!.querySelectorAll('[ks-inverted="true"]')];
  // Only the attribute route creates a region whose tokens have to be declared
  // inside it. Reaching for the `-inverted` tokens directly is the other route.
  if (inverted.length === 0) return;

  // The mistake this exists to catch: a band colour declared on the block, which
  // resolves against the page and inherits the light value into the dark column.
  expect(tokensDeclaredOutside(inverted, cssRules(compiled()))).toEqual([]);
});

test("the table scrolls sideways instead of squeezing its columns", () => {
  expect(compiled()).toMatch(/overflow-x:\s*(auto|scroll)/);
});

/* ──────────────────────────── still healthy ─────────────────────────────── */

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
