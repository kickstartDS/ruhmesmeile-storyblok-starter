/**
 * `880-contract-lookup` graded host-side.
 *
 * The eval asks whether the contract layer carries information nothing else in
 * the fixture carries, so the expected answers are **derived from the committed
 * contract set** rather than written down here. That is the point: a key that
 * was hardcoded would keep scoring after the contracts moved, and a lookup task
 * whose key has drifted measures nothing. If a derivation finds nothing this
 * throws — a loud failure beats scoring every arm zero and calling it a result.
 */

import { readFileSync } from "node:fs";

import { check, notApplicable, result, type GraderResult } from "./types";
import { readFile, type Trial } from "./trial";

/* ── just enough of the contract shape to read eight facts ─────────────────── */

interface AxisValue {
  api: unknown;
  class?: string | null;
}
interface Axis {
  prop: string;
  values: AxisValue[];
}
interface Binding {
  prop: string;
  mechanism: string;
  tokens?: string[];
}
interface Slot {
  prop: string;
  itemShape?: string[];
  accepts?: string[];
}
interface Variant {
  when?: Record<string, unknown>;
  parts?: Record<string, { styles?: Record<string, { to?: unknown; computed?: unknown }> }>;
}
interface Contract {
  anatomy?: { tokens?: string[] };
  axes?: Axis[];
  bindings?: Binding[];
  composition?: { slots?: Slot[] };
  coverage?: { axes?: Record<string, { missing?: unknown[] }> };
  variants?: Variant[];
  issues?: { segments?: string[] }[];
}

const CONTRACTS = new URL("../../../design-system/contracts/", import.meta.url);

/**
 * The committed set is validated against `contract.schema.json` before it is
 * written (design-system `contracts:validate`), so the document's shape is
 * established at the boundary this asserts.
 */
function contract(id: string): Contract {
  return JSON.parse(
    readFileSync(new URL(`${id}.contract.json`, CONTRACTS), "utf-8"),
  ) as Contract;
}

interface Expectation {
  id: string;
  question: string;
  expected: string | unknown[] | number;
  /** Arrays compare as sets — the order an agent writes them in is not a fact. */
  set?: boolean;
}

function required<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`contract-lookup: ${what} is no longer in the contract set`);
  }
  return value;
}

function expectations(): Expectation[] {
  const button = contract("button");
  const faq = contract("faq");
  const aside = contract("blog-aside");
  const section = contract("section");

  const variantAxis = required(
    button.axes?.find((axis) => axis.prop === "variant"),
    "Button's variant axis",
  );
  const primary = required(
    variantAxis.values.find((value) => value.api === "primary"),
    "Button's variant: primary",
  );
  const tertiary = required(
    variantAxis.values.find((value) => value.api === "tertiary"),
    "Button's variant: tertiary",
  );
  const variantBinding = required(
    button.bindings?.find((binding) => binding.prop === "variant"),
    "Button's variant binding",
  );
  const templated = required(
    variantBinding.tokens?.find((token) => token.endsWith("--background-color")),
    "Button's templated background token",
  );
  const primaryToken = templated.replace("{variant}", "primary");
  if (!(button.anatomy?.tokens ?? []).includes(primaryToken)) {
    throw new Error(`contract-lookup: ${primaryToken} is not in Button's anatomy tokens`);
  }

  const disabled = required(
    button.bindings?.find((binding) => binding.prop === "disabled")?.mechanism,
    "Button's disabled mechanism",
  );
  const itemShape = required(
    faq.composition?.slots?.find((slot) => slot.prop === "questions")?.itemShape,
    "Faq's questions itemShape",
  );
  const missing = required(
    button.coverage?.axes?.size?.missing,
    "Button's size coverage gap",
  );
  const segments = required(
    (aside.issues ?? []).find((issue) => (issue.segments?.length ?? 0) > 1)?.segments,
    "Blog Aside's token spelling drift",
  );
  const primaryVariant = required(
    button.variants?.find((variant) => variant.when?.variant === "primary"),
    "Button's variant: primary delta",
  );
  const rawComputed =
    primaryVariant.parts?.root?.styles?.backgroundColor?.to ??
    primaryVariant.parts?.root?.styles?.backgroundColor?.computed;
  const computed = required(
    typeof rawComputed === "string" ? rawComputed : undefined,
    "Button's primary background delta",
  );
  const accepts = required(
    section.composition?.slots?.find((slot) => slot.prop === "components")?.accepts,
    "Section's components slot",
  );

  return [
    { id: "q1", question: "Button's primary background token", expected: primaryToken },
    { id: "q2", question: "Button's tertiary root class", expected: required(tertiary.class, "Button's tertiary class") },
    { id: "q3", question: "Button's disabled mechanism", expected: disabled },
    { id: "q4", question: "Faq questions item props", expected: itemShape, set: true },
    { id: "q5", question: "Button size values with no story", expected: missing, set: true },
    { id: "q6", question: "Blog Aside token spellings", expected: segments, set: true },
    { id: "q7", question: "Button primary background computed", expected: computed },
    { id: "q8", question: "Section components slot arity", expected: accepts.length },
  ];
}

/* ── comparison ─────────────────────────────────────────────────────────────── */

/** Trim, strip the quoting an agent may add, and collapse whitespace. */
function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^[`'"]+|[`'"]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function matches(actual: unknown, entry: Expectation): boolean {
  if (entry.set && Array.isArray(entry.expected)) {
    if (!Array.isArray(actual)) return false;
    const want = new Set(entry.expected.map((value) => normalize(value)));
    const got = new Set(actual.map((value) => normalize(value)));
    return want.size === got.size && [...want].every((value) => got.has(value));
  }
  if (typeof entry.expected === "number") {
    const parsed = Number(String(actual ?? "").trim());
    return Number.isFinite(parsed) && parsed === entry.expected;
  }
  return normalize(actual) === normalize(entry.expected);
}

export function contractLookup(trial: Trial): GraderResult {
  if (trial.target.slug !== "contract-lookup") {
    return notApplicable(
      "contract-lookup",
      "contract",
      "only 880-contract-lookup asks about the contract set",
    );
  }

  const raw = readFile(trial, "answers.json");
  if (raw === null) {
    return result("contract-lookup", "contract", [
      check("answers-file", "answers.json was written", false, "not found at the repository root"),
    ]);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    return result("contract-lookup", "contract", [
      check("answers-file", "answers.json parses", false, String(error)),
    ]);
  }

  const checks = expectations().map((entry) =>
    check(
      entry.id,
      entry.question,
      matches(parsed[entry.id], entry),
      `expected ${JSON.stringify(entry.expected)}, got ${JSON.stringify(parsed[entry.id] ?? null)}`,
    ),
  );

  return result("contract-lookup", "contract", checks);
}
