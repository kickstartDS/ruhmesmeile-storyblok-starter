#!/usr/bin/env node
/**
 * Phase 0 spike runner — PRD §12, "Phase 0 — Spike (decision gate)".
 *
 * Emits Specs `api.yaml` for five deliberately awkward components, validates each
 * against @directededges/specs-schema@0.28.0, and scores fidelity against the
 * exit criteria:
 *
 *   1. all five validate cleanly
 *   2. >= 70 % of props map to a native AnyProp kind without load-bearing $extensions
 *   3. the BEM-derived anatomy draft is closer to "review and correct" than "rewrite"
 *
 * Usage:
 *   node scripts/specs-spike/run.mjs [--schema-dir <path>] [--out <path>]
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { emitSpec } from "./lib/emitSpec.mjs";
import { createValidator } from "./lib/validate.mjs";
import { loadSpecsStyleProperties } from "./lib/buildStyles.mjs";
import { toYaml } from "./lib/yaml.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DS_ROOT = resolve(HERE, "../..");

const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const SCHEMA_DIR = argOf(
  "--schema-dir",
  "/tmp/specs-eval/directededges-specs-schema-0.28.0/package/schema",
);
const OUT_DIR = argOf("--out", join(DS_ROOT, "dist-specs-spike"));

/** The five components from PRD §12, Phase 0. */
const SPIKE = [
  { name: "button", why: "trivial baseline" },
  {
    name: "section",
    why: "compositional + slots + nested objects + client behaviour",
  },
  { name: "faq", why: "array of sub-objects" },
  { name: "slider", why: "polymorphic anyOf children" },
  { name: "blog-aside", why: "two-level BEM nesting + nested object prop" },
];

// ── load shared inputs ───────────────────────────────────────────────────────
if (!existsSync(SCHEMA_DIR)) {
  console.error(
    `Specs schema not found at ${SCHEMA_DIR}\nRun: npm pack @directededges/specs-schema && tar xf *.tgz`,
  );
  process.exit(1);
}

const catalog = JSON.parse(
  readFileSync(join(DS_ROOT, "src/token/component-token-catalog.json"), "utf8"),
);
const validStyleProperties = loadSpecsStyleProperties(SCHEMA_DIR);
const validateSpec = createValidator(SCHEMA_DIR);

mkdirSync(OUT_DIR, { recursive: true });

// ── run ──────────────────────────────────────────────────────────────────────
const results = [];

for (const { name, why } of SPIKE) {
  const schemaPath = join(
    DS_ROOT,
    "src/components",
    name,
    `${name}.schema.dereffed.json`,
  );
  if (!existsSync(schemaPath)) {
    console.error(`  ! ${name}: no dereferenced schema at ${schemaPath}`);
    continue;
  }

  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const catalogEntry = catalog[name];

  const { spec, derived, records, styleDecisions, variantJoins } = emitSpec({
    componentName: name,
    schema,
    catalogEntry,
    validStyleProperties,
    examples: undefined,
  });

  const { valid, errors } = validateSpec(spec);

  mkdirSync(join(OUT_DIR, name), { recursive: true });
  writeFileSync(join(OUT_DIR, name, "api.yaml"), toYaml(spec));

  const total = records.length || 1;
  const byClass = { native: 0, extended: 0, lossy: 0 };
  for (const r of records) byClass[r.classification]++;

  const styleCounts = styleDecisions.reduce(
    (acc, d) => ({ ...acc, [d.outcome]: (acc[d.outcome] ?? 0) + 1 }),
    {},
  );

  results.push({
    name,
    why,
    valid,
    errors,
    props: {
      total: records.length,
      ...byClass,
      nativePct: Math.round((byClass.native / total) * 100),
    },
    anatomy: derived.stats,
    collisions: derived.collisions,
    styles: styleCounts,
    variantJoins,
    records,
    styleDecisions,
  });
}

// ── report ───────────────────────────────────────────────────────────────────
const line = "─".repeat(78);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

console.log(`\n${line}\nPHASE 0 SPIKE — Specs component contracts\n${line}`);
console.log(
  `schema:  @directededges/specs-schema (${SCHEMA_DIR.split("/").slice(-3, -2)})`,
);
console.log(`output:  ${OUT_DIR}\n`);

console.log("VALIDATION");
for (const r of results) {
  console.log(`  ${r.valid ? "PASS" : "FAIL"}  ${r.name.padEnd(12)} ${r.why}`);
  for (const e of r.errors.slice(0, 6)) console.log(`          ${e}`);
  if (r.errors.length > 6)
    console.log(`          … +${r.errors.length - 6} more`);
}

console.log(
  "\nPROP FIDELITY  (native = maps to an AnyProp kind, no load-bearing $extensions)",
);
console.log("  component     total  native  extended  lossy   native%");
let tAll = 0,
  tNative = 0;
for (const r of results) {
  tAll += r.props.total;
  tNative += r.props.native;
  console.log(
    `  ${r.name.padEnd(12)} ${String(r.props.total).padStart(5)}  ${String(r.props.native).padStart(6)}  ${String(r.props.extended).padStart(8)}  ${String(r.props.lossy).padStart(5)}   ${String(r.props.nativePct).padStart(5)}%`,
  );
}
console.log(
  `  ${"TOTAL".padEnd(12)} ${String(tAll).padStart(5)}  ${String(tNative).padStart(6)}  ${" ".repeat(8)}  ${" ".repeat(5)}   ${String(pct(tNative, tAll)).padStart(5)}%`,
);

console.log("\nANATOMY DERIVATION  (from BEM token names)");
console.log(
  "  component     tokens  parsed  unparsed  elements  name collisions",
);
for (const r of results) {
  const a = r.anatomy;
  console.log(
    `  ${r.name.padEnd(12)} ${String(a.tokensTotal).padStart(6)}  ${String(a.tokensParsed).padStart(6)}  ${String(a.tokensUnparsed).padStart(8)}  ${String(a.elementsDerived).padStart(8)}  ${String(a.collisions).padStart(15)}`,
  );
  if (a.unparsed.length)
    console.log(
      `               unparsed: ${a.unparsed.slice(0, 3).join(", ")}`,
    );
  for (const c of r.collisions ?? [])
    console.log(
      `               collision '${c.name}': ${c.paths.join("  |  ")}`,
    );
}

console.log("\nSTYLE EMISSION  (per-token decisions)");
console.log(
  "  component     emitted  omitted  variant  displaced  lossy  unresolvable",
);
for (const r of results) {
  const s = r.styles;
  console.log(
    `  ${r.name.padEnd(12)} ${String(s.emitted ?? 0).padStart(7)}  ${String(s.omitted ?? 0).padStart(7)}  ${String(s.variant ?? 0).padStart(7)}  ${String(s.displaced ?? 0).padStart(9)}  ${String(s.lossy ?? 0).padStart(5)}  ${String(s.unresolvable ?? 0).padStart(12)}`,
  );
}

console.log("\nENUM → BEM MODIFIER JOIN  (the contract Phase 2 would enforce)");
for (const r of results) {
  if (!r.variantJoins.length) continue;
  const joined = r.variantJoins.filter((v) => v.joined);
  console.log(
    `  ${r.name}: ${joined.length}/${r.variantJoins.length} token variants joined to a schema enum`,
  );
  for (const v of r.variantJoins) {
    console.log(
      `     ${v.joined ? "OK  " : "MISS"} _${v.variant}${v.joined ? ` → props.${v.prop}` : " → no enum contains this value"}`,
    );
  }
}

// ── exit criteria ────────────────────────────────────────────────────────────
const allValid = results.every((r) => r.valid);
const nativePct = pct(tNative, tAll);

console.log(`\n${line}\nEXIT CRITERIA\n${line}`);
console.log(
  `  ${allValid ? "PASS" : "FAIL"}  all five specs validate against component.schema.json`,
);
console.log(
  `  ${nativePct >= 70 ? "PASS" : "FAIL"}  >= 70% of props map natively  (actual: ${nativePct}%)`,
);
console.log(
  `  ----  anatomy draft quality: human judgement, see dist-specs-spike/*/api.yaml`,
);

writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(results, null, 2));
console.log(`\nfull report: ${join(OUT_DIR, "report.json")}\n`);
