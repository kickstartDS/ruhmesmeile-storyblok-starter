/**
 * Assemble a Specs `Component` from kickstartDS sources.
 *
 * Sources (all read-only — this is a one-way projection, per PRD §3.0):
 *   {name}.schema.dereffed.json   → props
 *   component-token-catalog.json  → anatomy draft, layout, styles, variants
 *   {Name}.stories.tsx / snippets → instanceExamples
 */

import { deriveAnatomy, buildLayout } from "./deriveAnatomy.mjs";
import { mapProps } from "./mapProps.mjs";
import { buildStyles } from "./buildStyles.mjs";

/** Elements the token layer never mentions still need to exist for slots to bind. */
function ensureSlotElements(anatomy, children, slotProps) {
  for (const slotName of slotProps) {
    const elementName = slotName.replace(/\./g, "_");
    if (!anatomy[elementName]) {
      anatomy[elementName] = { type: "slot", detectedIn: "prop:" + slotName };
      children.get("root").add(elementName);
      children.set(elementName, new Set());
    }
  }
}

export function emitSpec({
  componentName,
  schema,
  catalogEntry,
  examples,
  validStyleProperties,
}) {
  const derived = deriveAnatomy(componentName, catalogEntry);
  const { props, records } = mapProps(schema);

  const slotProps = records
    .filter((r) => r.prop.type === "slot")
    .map((r) => r.name);
  ensureSlotElements(derived.anatomy, derived.children, slotProps);

  // ── default variant ───────────────────────────────────────────────────────
  const configuration = {};
  for (const [name, prop] of Object.entries(props)) {
    if (prop.default !== undefined && prop.default !== null)
      configuration[name] = prop.default;
  }

  const elements = {};
  const styleDecisions = [];
  for (const name of Object.keys(derived.anatomy)) {
    const element = {};
    const parent =
      name === "root" ? null : (derived.parents.get(name) ?? "root");
    element.parent = parent;

    const kids = [...(derived.children.get(name) ?? [])].sort();
    if (kids.length) element.children = kids;

    // Bind slot elements back to the prop that fills them (Specs SlotBinding).
    const boundSlot = slotProps.find((s) => s.replace(/\./g, "_") === name);
    if (boundSlot) element.children = { $binding: `#/props/${boundSlot}` };

    const { styles, decisions } = buildStyles(
      derived.tokensByElement.get(name) ?? [],
      validStyleProperties,
    );
    styleDecisions.push(...decisions);
    if (Object.keys(styles).length) element.styles = styles;

    elements[name] = element;
  }

  const defaultVariant = {
    configuration,
    elements,
    layout: [buildLayout("root", derived.children)],
  };

  // ── variants ──────────────────────────────────────────────────────────────
  // Root variants (e.g. --dsa-button_primary--*) are joined back to the schema
  // enum whose values match. This is the enum → BEM modifier → token contract.
  const variants = [];
  const variantJoins = [];
  for (const variantName of derived.rootVariants) {
    const owningProp = Object.entries(props).find(
      ([, prop]) => Array.isArray(prop.enum) && prop.enum.includes(variantName),
    );
    if (owningProp) {
      variants.push({ configuration: { [owningProp[0]]: variantName } });
      variantJoins.push({
        variant: variantName,
        prop: owningProp[0],
        joined: true,
      });
    } else {
      variantJoins.push({ variant: variantName, prop: null, joined: false });
    }
  }

  const spec = {
    title: schema.title ?? componentName,
    anatomy: derived.anatomy,
    ...(Object.keys(props).length ? { props } : {}),
    default: defaultVariant,
    ...(variants.length ? { variants } : {}),
    ...(examples?.length ? { instanceExamples: examples } : {}),
  };

  return { spec, derived, records, styleDecisions, variantJoins };
}
