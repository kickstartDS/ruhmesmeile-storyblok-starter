/**
 * Grammar for kickstartDS component token names.
 *
 * Observed shape across `component-token-catalog.json`:
 *
 *   --dsa-<component>[_<variant>](__<element>[_<variant>])*--<property>[_<qualifier>]
 *
 * Worked examples:
 *
 *   --dsa-button--padding                      root,        prop=padding
 *   --dsa-button_small--font                   root+small,  prop=font
 *   --dsa-button_primary--color_hover          root+primary,prop=color,  state=hover
 *   --dsa-faq__summary--color                  el=summary,  prop=color
 *   --dsa-faq_header--padding                  root+header, prop=padding
 *   --dsa-section__col--min-width_smallest     el=col,      prop=min-width, modifier=smallest
 *   --dsa-blog-aside__author__title--font      el=author>title, prop=font
 *
 * `__` introduces an element, a single `_` qualifies the segment before it, and
 * `--` separates the element path from the CSS property.
 */

const TOKEN_PREFIX = "--dsa-";

/** Qualifiers that denote an interaction state rather than a design variant. */
export const STATE_QUALIFIERS = new Set([
  "hover",
  "active",
  "focus",
  "focus-visible",
  "focus-within",
  "disabled",
  "visited",
  "checked",
  "open",
  "selected",
  "current",
]);

/**
 * Parse a single token name into its structural parts.
 * Returns `null` for anything that does not match the grammar.
 */
export function parseTokenName(tokenName, componentName) {
  if (!tokenName.startsWith(TOKEN_PREFIX)) return null;

  const body = tokenName.slice(TOKEN_PREFIX.length);
  const split = body.indexOf("--");
  if (split === -1) return null;

  const pathPart = body.slice(0, split);
  const propPart = body.slice(split + 2);
  if (!propPart) return null;

  const segments = pathPart.split("__");

  // The first segment is the component itself, optionally carrying a variant.
  const head = segments[0];
  if (!head.startsWith(componentName)) return null;
  const headRest = head.slice(componentName.length);
  if (headRest && !headRest.startsWith("_")) return null;
  const rootVariant = headRest ? headRest.slice(1) : null;

  // Remaining segments are nested BEM elements, each optionally qualified.
  const elements = [];
  for (const segment of segments.slice(1)) {
    const at = segment.indexOf("_");
    elements.push(
      at === -1
        ? { name: segment, variant: null }
        : { name: segment.slice(0, at), variant: segment.slice(at + 1) },
    );
  }

  // The property may carry a trailing qualifier: a state or a design modifier.
  const at = propPart.indexOf("_");
  const property = at === -1 ? propPart : propPart.slice(0, at);
  const qualifier = at === -1 ? null : propPart.slice(at + 1);
  const isState = qualifier !== null && STATE_QUALIFIERS.has(qualifier);

  return {
    token: tokenName,
    component: componentName,
    rootVariant,
    elements,
    elementPath: elements.map((e) => e.name),
    leaf: elements.length ? elements[elements.length - 1].name : "root",
    property,
    state: isState ? qualifier : null,
    modifier: isState ? null : qualifier,
  };
}

/** Parse every token of a catalog entry, reporting anything the grammar rejects. */
export function parseComponentTokens(componentName, tokens) {
  const parsed = [];
  const unparsed = [];

  for (const [tokenName, meta] of Object.entries(tokens ?? {})) {
    const result = parseTokenName(tokenName, componentName);
    if (result) parsed.push({ ...result, meta });
    else unparsed.push(tokenName);
  }

  return { parsed, unparsed };
}
