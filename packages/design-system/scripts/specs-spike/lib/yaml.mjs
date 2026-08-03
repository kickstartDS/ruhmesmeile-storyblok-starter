/**
 * Minimal YAML serializer for Specs output.
 *
 * The Specs CLI reads `api.yaml`, so we need YAML rather than JSON. The emitted
 * structures are simple (maps, arrays, scalars — no anchors, tags or multi-doc),
 * so a ~70-line writer avoids adding a dependency to the design system build.
 */

const NEEDS_QUOTE =
  /^$|^[\s>|*&!%@`{}[\],#?:-]|[:#]\s|\s$|^(?:true|false|null|yes|no|on|off|~)$/i;
const IS_NUMERIC = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

function scalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "null";

  const str = String(value);
  if (NEEDS_QUOTE.test(str) || IS_NUMERIC.test(str) || str.includes("\n")) {
    return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  return str;
}

function isScalar(value) {
  return value === null || value === undefined || typeof value !== "object";
}

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0;
  return Object.keys(value).length === 0;
}

/** Render a flow sequence when every item is a short scalar — keeps enums readable. */
function tryFlowSequence(list) {
  if (!list.every(isScalar)) return null;
  const rendered = `[${list.map(scalar).join(", ")}]`;
  return rendered.length <= 72 ? rendered : null;
}

function emit(value, indent, lines) {
  const pad = "  ".repeat(indent);

  if (Array.isArray(value)) {
    for (const item of value) {
      if (isScalar(item)) {
        lines.push(`${pad}- ${scalar(item)}`);
      } else if (isEmpty(item)) {
        lines.push(`${pad}- ${Array.isArray(item) ? "[]" : "{}"}`);
      } else {
        const nested = [];
        emit(item, indent + 1, nested);
        // Hoist the first line onto the dash to keep the block compact.
        lines.push(`${pad}- ${nested[0].trimStart()}`);
        lines.push(...nested.slice(1));
      }
    }
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    const label = `${pad}${scalar(key)}:`;

    if (isScalar(item)) {
      lines.push(`${label} ${scalar(item)}`);
    } else if (isEmpty(item)) {
      lines.push(`${label} ${Array.isArray(item) ? "[]" : "{}"}`);
    } else if (Array.isArray(item)) {
      const flow = tryFlowSequence(item);
      if (flow) {
        lines.push(`${label} ${flow}`);
      } else {
        lines.push(label);
        emit(item, indent + 1, lines);
      }
    } else {
      lines.push(label);
      emit(item, indent + 1, lines);
    }
  }
}

export function toYaml(value) {
  const lines = [];
  emit(value, 0, lines);
  return lines.join("\n") + "\n";
}
