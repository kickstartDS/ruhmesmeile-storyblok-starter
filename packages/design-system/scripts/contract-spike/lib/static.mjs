/**
 * Pass 1 — Static extraction. No browser.
 *
 * Reads only artifacts that already exist on disk:
 *   - {n}.schema.dereffed.json      → prop API
 *   - {Name}Defaults.ts             → default configuration
 *   - component-token-catalog.json  → token names + reference chains
 *   - semantic-token-catalog.json   → `resolves` roots
 *   - snippets.json                 → per-story args + screenshot paths
 *   - storybook-static/index.json   → story ids
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseComponentTokens } from "./tokenGrammar.mjs";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

/** kebab-case component id → PascalCase file prefix. */
const pascal = (id) =>
  id
    .split("-")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");

/**
 * `{Name}Defaults.ts` is a generated file whose body is a JSON object literal.
 * Extract it without executing TypeScript.
 */
export function readDefaults(root, id) {
  const file = join(root, "src/components", id, `${pascal(id)}Defaults.ts`);
  if (!existsSync(file)) return {};
  const src = readFileSync(file, "utf8");
  const start = src.indexOf("= {");
  const end = src.lastIndexOf("};");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(src.slice(start + 2, end + 1));
  } catch {
    return {};
  }
}

/**
 * Classify a prop by what changing it does. This is the classification the
 * JSON Schema does not carry and an agent needs first.
 */
const APPEARANCE = /^(variant|style|theme|color|colour|appearance|look|tone|emphasis|size|width|height|ratio|aspectRatio|align|alignment|spacing|gap|density|inverted|highlight|mode|contentMode|backgroundColor|background)$/i;
const STATE = /^(disabled|active|selected|checked|open|expanded|loading|current|readonly|required|invalid)$/i;
const BEHAVIOUR = /^(url|href|target|newTab|type|onClick|autoplay|loop|delay|interval|method|action|name|id|ariaLabel|rel)$/i;
const LAYOUT = /^(layout|columns|rows|direction|orientation|order|position|sticky|fullWidth|contentAlign|headlineAlign)$/i;

function classifyRole(name, schema) {
  if (schema.type === "array") return "composition";
  if (LAYOUT.test(name)) return "layout";
  if (STATE.test(name) || (schema.type === "boolean" && STATE.test(name)))
    return "state";
  if (APPEARANCE.test(name)) return "appearance";
  if (BEHAVIOUR.test(name)) return "behaviour";
  if (schema.type === "boolean") return "appearance";
  return "content";
}

/** Flatten a dereferenced schema's properties into the contract's `api.props`. */
function extractProps(schema) {
  const props = {};
  const required = new Set(schema.required || []);
  for (const [name, def] of Object.entries(schema.properties || {})) {
    const entry = { role: classifyRole(name, def) };
    if (def.enum) {
      entry.type = "enum";
      entry.values = def.enum;
    } else if (def.type === "array") {
      entry.type = "array";
    } else if (def.type === "object") {
      entry.type = "object";
    } else {
      entry.type = def.type || "string";
    }
    if (def.default !== undefined) entry.default = def.default;
    if (def.format) entry.format = def.format;
    if (required.has(name)) entry.required = true;
    props[name] = entry;
  }
  return props;
}

/** Array props become slots. `items.anyOf` $refs enumerate what they accept. */
function extractSlots(schema) {
  const slots = [];
  for (const [name, def] of Object.entries(schema.properties || {})) {
    if (def.type !== "array") continue;
    const items = def.items || {};
    const slot = { prop: name };
    if (typeof def.minItems === "number") slot.min = def.minItems;
    if (typeof def.maxItems === "number") slot.max = def.maxItems;
    if (Array.isArray(items.anyOf)) {
      slot.accepts = items.anyOf
        .map((s) => {
          const id = s.$id || s.$ref || "";
          const m = id.match(/([a-z0-9-]+)\.schema\.json$/);
          return m ? m[1] : (s.title || "").toLowerCase().replace(/\s+/g, "-");
        })
        .filter(Boolean)
        .sort();
    } else if (items.properties) {
      slot.itemShape = Object.keys(items.properties).sort();
    } else if (items.type) {
      slot.itemShape = [items.type];
    }
    slots.push(slot);
  }
  return slots;
}

/**
 * Candidate axes: every enum and boolean prop, joined to the token vocabulary
 * via the root-variant segments found in the token catalog. The DOM class
 * column is filled in later, in Pass 3, from observation.
 */
function buildCandidateAxes(props, parsedTokens) {
  const segments = new Set(
    parsedTokens.map((t) => t.rootVariant).filter(Boolean)
  );
  const axes = [];
  for (const [name, def] of Object.entries(props)) {
    if (def.type !== "enum" && def.type !== "boolean") continue;
    if (def.role === "behaviour" || def.role === "content") continue;
    const values = def.type === "boolean" ? [false, true] : def.values;
    axes.push({
      prop: name,
      default: def.default,
      values: values.map((v) => ({
        api: v,
        class: null, // observed in Pass 3
        tokenSegment: segments.has(String(v)) ? `_${v}` : null,
      })),
    });
  }
  return { axes, segments: [...segments].sort() };
}

/** Follow `referencedToken` chains to a semantic (`--ks-*`) root. */
function buildResolver(componentCatalog, semanticCatalog) {
  const semantic = new Set();
  for (const group of Object.values(semanticCatalog || {})) {
    for (const t of Object.keys(group?.tokens || group || {})) semantic.add(t);
  }
  const index = new Map();
  for (const entry of Object.values(componentCatalog)) {
    for (const [name, meta] of Object.entries(entry.tokens || {}))
      index.set(name, meta);
  }
  return function resolve(token, seen = new Set()) {
    if (seen.has(token)) return null;
    seen.add(token);
    const meta = index.get(token);
    if (!meta) return semantic.has(token) ? token : null;
    if (meta.valueType === "semantic-ref") return meta.referencedToken;
    if (meta.valueType === "component-ref")
      return meta.referencedToken ? resolve(meta.referencedToken, seen) : null;
    return null; // literal
  };
}

export function staticPass(root, id, shared) {
  const dir = join(root, "src/components", id);
  const schema = readJson(join(dir, `${id}.schema.dereffed.json`));
  const defaults = readDefaults(root, id);

  const catalogEntry = shared.componentTokens[id] || { tokens: {} };
  const tokenNames = Object.keys(catalogEntry.tokens || {}).sort();
  const { parsed, unparsed } = parseComponentTokens(id, catalogEntry.tokens || {});
  const resolve = buildResolver(shared.componentTokens, shared.semanticTokens);

  const props = extractProps(schema);
  const { axes, segments } = buildCandidateAxes(props, parsed);

  const stories = shared.snippets
    .filter((s) => shared.storyComponent.get(s.id) === id)
    .map((s) => ({ id: s.id, name: s.name, args: s.args || {}, screenshot: s.screenshot }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    id,
    title: schema.title || pascal(id),
    description: schema.description,
    schemaFile: `./${id}.schema.dereffed.json`,
    selector: catalogEntry.selector || null,
    api: { props, required: schema.required || [] },
    defaults,
    slots: extractSlots(schema),
    axes,
    tokenSegments: segments,
    tokens: tokenNames,
    parsedTokens: parsed,
    resolve,
    stories,
    unparsedTokens: unparsed,
  };
}

/** Load the artifacts shared by every component exactly once. */
export function loadShared(root) {
  const componentTokens = readJson(
    join(root, "src/token/component-token-catalog.json")
  );
  const semanticTokens = existsSync(
    join(root, "src/token/semantic-token-catalog.json")
  )
    ? readJson(join(root, "src/token/semantic-token-catalog.json"))
    : {};
  const snippets = readJson(join(root, "snippets.json"));
  const index = readJson(join(root, "storybook-static/index.json"));

  // story id → component id, from the story's import path
  const storyComponent = new Map();
  for (const entry of Object.values(index.entries)) {
    const m = entry.importPath.match(/\/components\/([a-z0-9-]+)\//);
    if (m) storyComponent.set(entry.id, m[1]);
  }
  return { componentTokens, semanticTokens, snippets, index, storyComponent };
}
