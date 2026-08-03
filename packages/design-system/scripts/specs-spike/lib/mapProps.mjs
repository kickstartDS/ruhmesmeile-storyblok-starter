/**
 * Map a kickstartDS JSON Schema onto the Specs `Props` model.
 *
 * Specs supports six prop kinds (boolean, string, enum, number, slot, image) in a
 * FLAT map. Our schemas are richer: they have `required`, `format`, nested objects,
 * arrays of objects, and polymorphic `anyOf` children. Everything the Specs model
 * cannot carry natively is displaced into `$extensions['com.kickstartds']`.
 *
 * Every prop is classified so Phase 0 can score fidelity honestly:
 *   native   — maps to an AnyProp kind, nothing load-bearing in $extensions
 *   extended — maps, but $extensions carries semantics a consumer would need
 *   lossy    — information is provably dropped (see PRD §8, registers P1/P2)
 */

const NS = "com.kickstartds";

/** Extension keys that a consumer *must* read to use the prop correctly. */
const LOAD_BEARING = new Set([
  "required",
  "format",
  "refs",
  "shape",
  "itemShape",
  "originalType",
]);

/** Turn `http://schema.mydesignsystem.com/image-text.schema.json` into `image-text`. */
function refToComponentName(ref) {
  const match = /\/([^/]+)\.schema\.json/.exec(ref ?? "");
  return match ? match[1] : null;
}

function buildExtensions(entries) {
  const payload = Object.fromEntries(
    Object.entries(entries).filter(([, v]) => v !== undefined && v !== null),
  );
  if (Object.keys(payload).length === 0)
    return { extensions: undefined, loadBearing: false };
  return {
    extensions: { [NS]: payload },
    loadBearing: Object.keys(payload).some((key) => LOAD_BEARING.has(key)),
  };
}

/**
 * Map one JSON Schema property to a Specs prop.
 * Returns `{ name, prop, classification, notes }` records — plural, because a
 * nested object expands into several dot-named scalar props (register P1).
 */
function mapProperty(name, schema, { required, path = [] }) {
  const results = [];
  const fullName = [...path, name].join(".");
  const doc = { title: schema.title, description: schema.description };

  // ── Nested object → flattened dot-named props (P1, S2 lossy) ───────────────
  if (schema.type === "object" && schema.properties) {
    for (const [childName, childSchema] of Object.entries(schema.properties)) {
      results.push(
        ...mapProperty(childName, childSchema, {
          required: (schema.required ?? []).includes(childName),
          path: [...path, name],
        }),
      );
    }
    // Mark the whole group as lossy once: the object boundary itself is gone.
    if (results.length) {
      results[0].notes.push(
        `object '${fullName}' flattened into ${results.length} scalar prop(s)`,
      );
      results[0].classification = "lossy";
      results[0].prop.$extensions ??= { [NS]: {} };
      results[0].prop.$extensions[NS].shape = `object:${fullName}`;
    }
    return results;
  }

  // ── Array → SlotProp ───────────────────────────────────────────────────────
  if (schema.type === "array") {
    const anyOf = schema.items?.anyOf;
    const prop = { type: "slot" };
    if (schema.minItems !== undefined) prop.minChildren = schema.minItems;
    if (schema.maxItems !== undefined) prop.maxChildren = schema.maxItems;

    if (Array.isArray(anyOf)) {
      // Polymorphic children (P3, S3): names are native, $ref URIs are displaced.
      const refs = anyOf.map((entry) => entry.$ref).filter(Boolean);
      const names = refs.map(refToComponentName).filter(Boolean);
      prop.anyOf = names;
      const { extensions, loadBearing } = buildExtensions({
        ...doc,
        required: required || undefined,
        refs,
      });
      if (extensions) prop.$extensions = extensions;
      results.push({
        name: fullName,
        prop,
        classification: loadBearing ? "extended" : "native",
        notes: [`polymorphic slot, ${names.length} permitted component types`],
      });
      return results;
    }

    // Array of sub-objects (P2, S2): the item shape has no home in Specs `Props`.
    const itemShape = schema.items?.properties
      ? Object.keys(schema.items.properties)
      : null;
    const { extensions } = buildExtensions({
      ...doc,
      required: required || undefined,
      itemShape: itemShape ?? undefined,
      originalType: "array",
    });
    if (extensions) prop.$extensions = extensions;
    results.push({
      name: fullName,
      prop,
      classification: "lossy",
      notes: itemShape
        ? [
            `array of objects; item shape {${itemShape.join(", ")}} displaced to $extensions (candidate subcomponent)`,
          ]
        : ["untyped array collapsed to slot"],
    });
    return results;
  }

  // ── Scalars ────────────────────────────────────────────────────────────────
  let prop;
  let classification = "native";
  const notes = [];

  if (schema.type === "boolean") {
    // BooleanProp.default is REQUIRED by the Specs schema; synthesise when absent (P9).
    prop = { type: "boolean", default: schema.default ?? false };
    if (schema.default === undefined)
      notes.push("default synthesised (Specs requires BooleanProp.default)");
  } else if (schema.type === "number" || schema.type === "integer") {
    prop = { type: "number" };
    if (schema.default !== undefined) prop.default = schema.default;
    if (schema.examples) prop.examples = schema.examples;
    // NumberProp has no $extensions in the Specs schema — documentation is dropped.
    if (schema.title || schema.description)
      notes.push("NumberProp has no $extensions; title/description dropped");
    return [
      {
        name: fullName,
        prop,
        classification: schema.title ? "lossy" : "native",
        notes,
      },
    ];
  } else if (schema.enum) {
    prop = { type: "string", enum: schema.enum };
    // EnumProp.default is required in practice for a usable contract.
    prop.default = schema.default ?? schema.enum[0];
    if (schema.default === undefined)
      notes.push("enum default synthesised from first value");
  } else if (schema.format === "image") {
    prop = { type: "image" };
    if (schema.default !== undefined) prop.default = schema.default;
  } else {
    // NOTE: Specs 0.28.0 `EnumProp` declares no `required` array, so a bare
    // `{type: "string"}` validates as BOTH StringProp and EnumProp and therefore
    // fails `AnyProp`'s `oneOf`. `examples` exists only on StringProp, so always
    // emitting it disambiguates. See spike finding D.
    prop = { type: "string", examples: schema.examples ?? [] };
    if (schema.default !== undefined) prop.default = schema.default;
    if (!schema.examples)
      notes.push(
        "empty examples[] emitted to disambiguate StringProp from EnumProp",
      );
  }

  const { extensions, loadBearing } = buildExtensions({
    ...doc,
    required: required || undefined,
    format:
      schema.format && schema.format !== "image" ? schema.format : undefined,
  });
  if (extensions) prop.$extensions = extensions;
  if (loadBearing) classification = "extended";

  results.push({ name: fullName, prop, classification, notes });
  return results;
}

export function mapProps(schema) {
  const required = new Set(schema.required ?? []);
  const props = {};
  const records = [];

  for (const [name, propSchema] of Object.entries(schema.properties ?? {})) {
    for (const record of mapProperty(name, propSchema, {
      required: required.has(name),
    })) {
      props[record.name] = record.prop;
      records.push(record);
    }
  }

  return { props, records };
}
