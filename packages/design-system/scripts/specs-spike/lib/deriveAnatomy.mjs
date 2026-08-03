/**
 * Derive a DRAFT Specs `anatomy` + `layout` from component token names.
 *
 * This is the mechanism §6.4 of the PRD claims is possible: 512 of 807 component
 * tokens carry a BEM element path, so the component's parts are already named in
 * the token layer. Output is explicitly a *draft* for human review — the token
 * layer only knows about parts that happen to be themeable.
 */

import { parseComponentTokens } from "./tokenGrammar.mjs";

/** Element-name hints → Specs `ElementType`. Everything else defaults to container. */
const TYPE_HINTS = [
  [
    /^(text|title|label|summary|answer|headline|heading|caption|description|name|date|copy|subtitle|excerpt|quote|value)$/,
    "text",
  ],
  [/^(icon|arrow|bullet|chevron|caret|glyph|marker|indicator|dot)$/, "glyph"],
  [/^(image|img|picture|thumb|thumbnail|avatar|logo|media)$/, "rectangle"],
  [/^(divider|rule|separator|line)$/, "line"],
  [/^(link|button|cta|action)$/, "instance"],
];

function inferElementType(name) {
  for (const [pattern, type] of TYPE_HINTS) {
    if (pattern.test(name)) return type;
  }
  return "container";
}

/**
 * Build anatomy (a flat Record, per the Specs schema) plus the nested layout tree
 * and the variant/state axes discovered along the way.
 */
export function deriveAnatomy(componentName, catalogEntry) {
  const { parsed, unparsed } = parseComponentTokens(
    componentName,
    catalogEntry?.tokens,
  );

  const anatomy = { root: { type: "container" } };
  const parents = new Map(); // element -> parent element
  const children = new Map([["root", new Set()]]);
  const tokensByElement = new Map([["root", []]]);

  const rootVariants = new Set();
  const propertyModifiers = new Map(); // css property -> Set(modifier)
  const states = new Set();
  const pathsByName = new Map(); // element name -> Set(full BEM path)

  for (const token of parsed) {
    if (token.rootVariant) rootVariants.add(token.rootVariant);
    if (token.state) states.add(token.state);
    if (token.modifier) {
      if (!propertyModifiers.has(token.property))
        propertyModifiers.set(token.property, new Set());
      propertyModifiers.get(token.property).add(token.modifier);
    }

    // Walk the BEM element path, registering each level.
    let parent = "root";
    const walked = [];
    for (const element of token.elements) {
      const { name } = element;
      walked.push(name);
      if (!anatomy[name]) {
        anatomy[name] = { type: inferElementType(name) };
        children.set(name, new Set());
        tokensByElement.set(name, []);
      }
      if (!pathsByName.has(name)) pathsByName.set(name, new Set());
      pathsByName.get(name).add(walked.join(" > "));
      if (!parents.has(name)) parents.set(name, parent);
      children.get(parent).add(name);
      parent = name;
    }

    tokensByElement.get(token.leaf).push(token);
  }

  // `detectedIn` records provenance, mirroring how Figma-sourced specs annotate origin.
  for (const [name, element] of Object.entries(anatomy)) {
    if (name === "root") {
      element.detectedIn = catalogEntry?.selector ?? `.dsa-${componentName}`;
    } else {
      element.detectedIn = `${catalogEntry?.selector ?? `.dsa-${componentName}`} ${name}`;
    }
  }

  // Specs `Anatomy` is a FLAT Record keyed by element name, so two distinct BEM
  // paths ending in the same name collapse into one element. Surface those.
  const collisions = [...pathsByName.entries()]
    .filter(([, paths]) => paths.size > 1)
    .map(([name, paths]) => ({ name, paths: [...paths] }));

  return {
    anatomy,
    layout: buildLayout("root", children),
    parents,
    children,
    tokensByElement,
    rootVariants: [...rootVariants].sort(),
    propertyModifiers,
    states: [...states].sort(),
    collisions,
    stats: {
      tokensTotal: Object.keys(catalogEntry?.tokens ?? {}).length,
      tokensParsed: parsed.length,
      tokensUnparsed: unparsed.length,
      unparsed,
      elementsDerived: Object.keys(anatomy).length - 1,
      collisions: collisions.length,
    },
  };
}

/** Turn the child map into the recursive `LayoutNode` shape Specs expects. */
export function buildLayout(name, children) {
  const kids = [...(children.get(name) ?? [])].sort();
  if (kids.length === 0) return name;
  return { [name]: kids.map((kid) => buildLayout(kid, children)) };
}
