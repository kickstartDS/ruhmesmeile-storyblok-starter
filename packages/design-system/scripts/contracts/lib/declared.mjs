/**
 * The declared default baseline (PRD §5.6).
 *
 * The default is *declared, not inferred*: `{Name}Defaults.ts` is taken exactly
 * as it stands. We never go looking for the story whose args sit closest to it,
 * which means every authored story is a variant.
 *
 * `{Name}Defaults.ts` only covers props that carry a schema `default`, so a
 * baseline built from it alone often cannot render (`faq` defaults to
 * `questions: []`, and its schema demands `minItems: 1`). The gap is filled
 * from the schema's own `examples` first — authored values, in the artifact
 * they should have come from — and only then from a fixed placeholder table.
 * Every value records which of the three it came from, so a synthetic baseline
 * is never mistaken for a designed one.
 */

const SLOT_ITEMS = 2;

const LOREM = "Lorem ipsum dolor sit amet";
const LOREM_LONG =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.";

/** Fixed, type- and format-aware placeholders. Deliberately boring and stable. */
function placeholder(node) {
  if (node.enum?.length) return node.enum[0];
  switch (node.format) {
    case "icon":
      return "arrow-right";
    case "uri":
    case "url":
      return "#";
    case "date":
      return "12/30/2022";
    case "image":
      return "img/placeholder.png";
    case "markdown":
      return LOREM_LONG;
    default:
      break;
  }
  switch (node.type) {
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return LOREM;
  }
}

/** Rank sources so a composite value reports its weakest link. */
const RANK = {
  "schema-default": 0,
  example: 1,
  placeholder: 2,
  "empty-slot": 3,
};
const weakest = (a, b) => (RANK[b] > RANK[a] ? b : a);

/**
 * Value for one schema node, preferring authored values over invented ones.
 * @returns {{value: unknown, source: "schema-default"|"example"|"placeholder"|"empty-slot"}}
 */
function valueFor(node, depth = 0) {
  if (node.default !== undefined)
    return { value: node.default, source: "schema-default" };
  if (node.examples?.length)
    return { value: node.examples[0], source: "example" };

  if (node.type === "object" && node.properties) {
    if (depth > 3) return { value: {}, source: "placeholder" };
    const required = new Set(node.required || []);
    const out = {};
    let source = "example";
    for (const [k, child] of Object.entries(node.properties)) {
      // Required props must be filled to render at all; beyond those we only
      // use values the schema itself authored, never invented ones.
      const authored = child.default !== undefined || child.examples?.length;
      if (!required.has(k) && !authored) continue;
      const r = valueFor(child, depth + 1);
      out[k] = r.value;
      source = weakest(source, r.source);
    }
    return { value: out, source };
  }

  if (node.type === "array") {
    // A polymorphic slot cannot be filled without inventing a child component,
    // which would be authoring. We leave it empty and report it as a gap.
    if (node.items?.anyOf || !node.items?.properties)
      return { value: [], source: "empty-slot" };
    if (depth > 3) return { value: [], source: "empty-slot" };
    const item = valueFor(node.items, depth + 1);
    return {
      value: Array.from({ length: SLOT_ITEMS }, () =>
        JSON.parse(JSON.stringify(item.value)),
      ),
      source: item.source,
    };
  }

  return { value: placeholder(node), source: "placeholder" };
}

/**
 * Build the declared default configuration for a component.
 *
 * Top-level policy is deliberately strict — a prop is only present when the
 * schema says it must be:
 *   - it carries a schema default (i.e. it is in `{Name}Defaults.ts`), or
 *   - it is `required`, or
 *   - it is an array with `minItems >= 1` that the defaults leave empty.
 *
 * Everything else stays unset, because unset *is* the default.
 */
export function buildDeclared(schema, defaults = {}) {
  const required = new Set(schema.required || []);
  const config = {};
  const sources = {};
  const gaps = [];

  for (const [prop, node] of Object.entries(schema.properties || {})) {
    const declared = defaults[prop];
    const hasDeclared = declared !== undefined;
    const emptyArray = Array.isArray(declared) && declared.length === 0;
    const needsItems = node.type === "array" && (node.minItems ?? 0) >= 1;

    if (hasDeclared) {
      config[prop] = declared;
      sources[prop] = "schema-default";
    }

    // Fill only when the schema demands it.
    const mustFill = hasDeclared
      ? emptyArray && (required.has(prop) || needsItems)
      : required.has(prop) || needsItems;

    if (mustFill) {
      const { value, source } = valueFor(node);
      config[prop] = value;
      sources[prop] = source;
    }

    if (sources[prop] === "placeholder")
      gaps.push({ prop, kind: "placeholder" });
    if (
      node.type === "array" &&
      Array.isArray(config[prop]) &&
      config[prop].length === 0
    )
      gaps.push({ prop, kind: "empty-slot" });
  }

  return { config, sources, gaps };
}
