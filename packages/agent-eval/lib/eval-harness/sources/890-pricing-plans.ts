/**
 * 890 — build a row of pricing plans where the recommended one comes from the
 * token layer, not from a colour scheme of its own.
 *
 * The component is written from scratch against a schema that is handed to the
 * agent. Three things in it are design-system knowledge rather than CSS:
 *
 *   - the recommended plan inverts by putting `ks-inverted` on itself and
 *     letting the semantic tokens flip underneath it (806's lesson, applied to
 *     something the agent authors instead of edits);
 *   - the surface it inverts onto is the card pair from the token vocabulary
 *     (`--ks-background-color-card-interactive`), which is one declaration that
 *     reads as the light surface outside and the dark one inside — and because
 *     a custom property is substituted where it is declared, that declaration
 *     has to sit on the element that inverts;
 *   - the halo has to end up behind the card, and a card that paints its own
 *     background paints over a `z-index: -1` child of its own. The surface
 *     therefore has to live on a child element. That is asserted against the
 *     rendered DOM rather than the stylesheet: whichever element hosts the halo
 *     must not be the element that paints the surface.
 *
 * What is deliberately not asserted: which tokens are chosen, how the row is
 * laid out (grid or flex), and whether the halo is a gradient, a shadow or
 * absent. The contract graders and the rubrics score those.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const requireCjs = createRequire(import.meta.url);

const harness = createHarness({
  dir: "src/components/pricing-plans",
  slug: "pricing-plans",
  pascal: "PricingPlans",
  renderProps: {
    layout: "equal",
    plan: [
      {
        name: "Basic",
        price: "$99",
        pricePeriod: "per month",
        description: "For a single landing page.",
        cta: { url: "#", label: "Get Started" },
        featureListTitle: "What's included:",
        featureList: [{ text: "130+ coded blocks" }],
      },
      {
        name: "Premium",
        price: "$199",
        pricePeriod: "per month",
        description: "For teams shipping several sites.",
        badge: "Popular",
        highlight: true,
        cta: { url: "#", label: "Book a meeting" },
        featureListTitle: "What's included:",
        featureList: [
          { text: "130+ coded blocks" },
          { text: "Premium support", icon: "check" },
        ],
      },
      {
        name: "Enterprise",
        price: "$399",
        pricePeriod: "per month",
        description: "For several brands and teams.",
        cta: { url: "#", label: "Talk to us" },
        featureListTitle: "What's included:",
        featureList: [{ text: "130+ coded blocks" }],
      },
    ],
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  schema: shipped("src/components/pricing-plans/pricing-plans.schema.json"),
};

/** The price of the recommended plan, and of the ones beside it. */
const HIGHLIGHTED_PRICE = "$199";
const OTHER_PRICES = ["$99", "$399"];

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

/**
 * Colour values that are not a token.
 *
 * `var(--…)` is the answer and never the problem, so a declaration that is
 * nothing but a custom-property reference is not a literal however colourful
 * the fallback inside it is.
 */
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

/**
 * Selector/declaration pairs out of compiled CSS.
 *
 * Deliberately not a parser: sass has already flattened the nesting by the time
 * this sees it, so `selector { … }` pairs are all there is. `@media` wrappers
 * fall out on their own, because a selector cannot contain a brace.
 */
export function cssRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selector: match[1].trim(), body: match[2].trim() });
  }
  return rules;
}

/** Selectors whose declarations paint a surface. */
export function surfaceSelectors(rules: CssRule[]): string[] {
  return rules
    .filter(({ body }) => {
      const match = body.match(/(^|[;\s{])background(-color|-image)?\s*:\s*([^;]+)/);
      if (!match) return false;
      const value = match[3].trim();
      return value !== "none" && value !== "transparent";
    })
    .map(({ selector }) => selector);
}

/** Selectors that declare a negative z-index: the halo's host. */
export function haloSelectors(rules: CssRule[]): string[] {
  return rules
    .filter(({ body }) => /(^|[;\s{])z-index\s*:\s*-\d+/.test(body))
    .map(({ selector }) => selector);
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

/**
 * Elements that both paint a surface and host the halo.
 *
 * Returned as a description string per offending element, so a failure says
 * which element did it rather than just how many.
 */
export function haloOverSurface(
  elements: Element[],
  hosts: string[],
  surfaces: string[],
): string[] {
  const matchesAny = (element: Element, selectors: string[]) =>
    selectors.some((selector) => {
      try {
        return element.matches(selector);
      } catch {
        // A selector jsdom cannot evaluate (a vendor pseudo-class, say) is not
        // evidence of anything.
        return false;
      }
    });

  const hosted = elements.filter((element) => matchesAny(element, hosts));
  return hosted
    .filter((element) => matchesAny(element, surfaces))
    .map((element) => element.outerHTML.slice(0, 120));
}

/* ────────────────────────── reading the render ──────────────────────────── */

/** The component as it renders, parsed. */
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

test("the row lays the plans out along one axis", () => {
  expect(allStyles()).toMatch(/display:\s*(grid|flex)/);
});

/* ────────────────────── what the render has to show ─────────────────────── */

test("the recommended plan inverts through the token layer", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();

  const text = (element: Element) => element.textContent ?? "";
  // The recommended plan is the region that holds its price and none of the
  // prices beside it, so an inversion applied to the row or to every plan is
  // still not this.
  const plan = [...root!.querySelectorAll("*")].find(
    (element) =>
      text(element).includes(HIGHLIGHTED_PRICE) &&
      !OTHER_PRICES.some((price) => text(element).includes(price)),
  );
  expect(plan).toBeDefined();

  const marked =
    plan!.getAttribute("ks-inverted") === "true" ||
    Boolean(plan!.querySelector('[ks-inverted="true"]'));
  const tokens = usesInvertedTokens(plan!, cssRules(compiled()));

  // Marked region, or inverted tokens — either reaches the inverted layer.
  expect(
    marked || tokens,
    `inverted: attribute=${marked} tokens=${tokens}`,
  ).toBe(true);
});

test("the call to action is the library's, not a hand-rolled control", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();

  const controls = [...root!.querySelectorAll("button, a")];
  expect(controls.length).toBe(3);
  expect(
    controls.filter((control) => String(control.className).includes("dsa-button"))
      .length,
  ).toBe(3);
});

test("the halo is painted behind the card, not over it", async () => {
  const rules = cssRules(compiled());
  const halos = haloSelectors(rules);
  // A halo drawn as a shadow, or not drawn at all, has nothing to host.
  if (halos.length === 0) return;

  const hosts = halos.map(hostOf);
  const surfaces = surfaceSelectors(rules).filter(
    (selector) => !halos.includes(selector),
  );

  const root = await rendered();
  expect(root).not.toBeNull();

  expect(
    haloOverSurface([...root!.querySelectorAll("*")], hosts, surfaces),
  ).toEqual([]);
});

test("the colours of the recommended plan are declared where the inversion applies", async () => {
  const root = await rendered();
  expect(root).not.toBeNull();

  const inverted = [...root!.querySelectorAll('[ks-inverted="true"]')];
  // Only the attribute route creates a region whose tokens have to be declared
  // inside it. Reaching for the `-inverted` tokens directly is the other route
  // and does not.
  if (inverted.length === 0) return;

  // A token declared above the inverted element resolves against the page and
  // freezes the light value into the card.
  expect(tokensDeclaredOutside(inverted, cssRules(compiled()))).toEqual([]);
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
