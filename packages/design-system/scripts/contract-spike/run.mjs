#!/usr/bin/env node
/**
 * Spike: derive kickstartDS Component Contracts for the same five components
 * the Specs spike covered, so the two formats can be compared side by side.
 *
 *   node scripts/contract-spike/run.mjs [--out dist-contract-spike] [--only button]
 *
 * Pass 1  static extraction   (schemas, defaults, token catalogs)
 * Pass 2  rendered observation (Playwright over storybook-static)
 * Pass 3  reconciliation       (anatomy, axes, variants, bindings, coverage)
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { loadShared, staticPass } from "./lib/static.mjs";
import { writeDefaultStories, defaultStoryId } from "./lib/genStories.mjs";
import { observe } from "./lib/observe.mjs";
import { reconcile } from "./lib/reconcile.mjs";
import { buildBrief } from "./lib/brief.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SPIKE = ["button", "section", "faq", "slider", "blog-aside"];
const VIEWPORT = { width: 1440, height: 900 };

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const OUT = join(ROOT, arg("out", "dist-contract-spike"));
const ONLY = arg("only", null);
const components = ONLY ? [ONLY] : SPIKE;

/** Deterministic output: sort every object key. */
const sortKeys = (v) => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object" && v.constructor === Object) {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortKeys(v[k])]),
    );
  }
  return v;
};

const sha = (p) =>
  existsSync(p)
    ? "sha256:" +
      createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16)
    : null;

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

/* ------------------------------------------------------------------ run */

console.log(`\nkickstartDS Component Contract spike`);
console.log(`components: ${components.join(", ")}`);
console.log(
  `viewport:   ${VIEWPORT.width}×${VIEWPORT.height} (desktop-only)\n`,
);

const shared = loadShared(ROOT);

console.log("Pass 1 — static extraction");
const statics = new Map();
for (const id of components) {
  const s = staticPass(ROOT, id, shared);
  s.defaultStory = { id: defaultStoryId(id), screenshot: null };
  statics.set(id, s);
  const gaps = s.declared.gaps.length
    ? `  ⚠ ${s.declared.gaps.length} baseline gaps`
    : "";
  console.log(
    `  ${pad(id, 12)} ${lpad(Object.keys(s.api.props).length, 3)} props  ` +
      `${lpad(s.tokens.length, 3)} tokens  ${lpad(s.stories.length, 2)} stories  ` +
      `${lpad(s.axes.length, 2)} candidate axes` +
      (s.unparsedTokens.length
        ? `  ⚠ ${s.unparsedTokens.length} unparsed`
        : "") +
      gaps,
  );
}

// The declared default has no authored story, so we generate one and let
// Storybook render it through the same decorators every other story uses.
const storiesDir = writeDefaultStories(
  ROOT,
  [...statics.values()].map((s) => ({ id: s.id, config: s.declared.config })),
);
console.log(
  `\n  wrote ${components.length} declared-default stories to ${storiesDir.replace(ROOT + "/", "")}/`,
);

// Storybook has to be rebuilt before the generated stories can be observed, so
// story emission is available as its own step:
//   node run.mjs --emit-stories && pnpm build-storybook && node run.mjs
if (argv.includes("--emit-stories")) {
  console.log("  --emit-stories: stopping before observation\n");
  process.exit(0);
}
if (!existsSync(join(ROOT, "storybook-static", "index.json")))
  console.log("  ⚠ storybook-static missing — run build-storybook first");

console.log("\nPass 2 — rendered observation");
const jobs = [];
for (const [id, s] of statics) {
  jobs.push({ storyId: s.defaultStory.id, tokens: s.tokens });
  for (const st of s.stories) jobs.push({ storyId: st.id, tokens: s.tokens });
}

const observations = await observe({
  storybookDir: join(ROOT, "storybook-static"),
  jobs,
  viewport: VIEWPORT,
  onProgress: (id, ok) => console.log(`  ${ok ? "ok  " : "FAIL"}  ${id}`),
});

mkdirSync(join(OUT, ".observations"), { recursive: true });
for (const [storyId, obs] of Object.entries(observations))
  writeFileSync(
    join(OUT, ".observations", `${storyId}.json`),
    JSON.stringify(obs, null, 1),
  );

console.log("\nPass 3 — reconciliation");
const report = {
  format: "kickstartds/component-contract@1",
  viewport: VIEWPORT,
  components: {},
};

for (const [id, s] of statics) {
  const derived = reconcile(s, observations);
  if (derived.error) {
    console.log(`  ${pad(id, 12)} ERROR ${derived.error}`);
    continue;
  }

  const dir = join(ROOT, "src/components", id);
  const contract = sortKeys({
    $format: "kickstartds/component-contract@1",
    id,
    title: s.title,
    description: s.description,
    generated: {
      inputs: {
        schema: sha(join(dir, `${id}.schema.dereffed.json`)),
        tokens: sha(join(ROOT, "src/token/component-token-catalog.json")),
        stories: sha(join(ROOT, "snippets.json")),
      },
      viewport: VIEWPORT,
      theme: "default",
    },
    api: { schema: s.schemaFile, required: s.api.required, props: s.api.props },
    anatomy: derived.anatomy,
    axes: derived.axes,
    default: derived.default,
    variants: derived.variants,
    bindings: derived.bindings,
    composition: derived.composition,
    coverage: derived.coverage,
    issues: derived.issues,
  });

  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(
    join(OUT, id, `${id}.contract.json`),
    JSON.stringify(contract, null, 2) + "\n",
  );

  // Pass 4 (§5.12) is out of band: the narrative is a separate, model-generated
  // sidecar that lives beside the component. The contract never depends on it,
  // and the brief renders fine without it.
  const narrativeFile = join(dir, `${id}.narrative.json`);
  const narrative = existsSync(narrativeFile)
    ? JSON.parse(readFileSync(narrativeFile, "utf8"))
    : null;
  if (narrative)
    writeFileSync(
      join(OUT, id, `${id}.narrative.json`),
      JSON.stringify(narrative, null, 2) + "\n",
    );

  writeFileSync(
    join(OUT, id, `${id}.brief.md`),
    buildBrief(contract, narrative),
  );

  report.components[id] = {
    props: Object.keys(s.api.props).length,
    tokens: s.tokens.length,
    stories: s.stories.length,
    observed: derived.coverage.stories.observed,
    failedStories: derived.failed,
    parts: derived.coverage.parts,
    axes: derived.axes.map((a) => ({
      prop: a.prop,
      joined: a.values.filter(
        (v) => v.class !== null || v.tokenSegment !== null,
      ).length,
      total: a.values.length,
      issues: a.values.flatMap((v) =>
        (v.issues || []).map((i) => `${a.prop}:${v.api} ${i}`),
      ),
    })),
    mechanisms: derived.bindings.reduce((acc, b) => {
      acc[b.mechanism] = (acc[b.mechanism] || 0) + 1;
      return acc;
    }, {}),
    naming: derived.namingStats,
    variants: derived.variants.length,
    coverage: derived.coverage,
    contractBytes: JSON.stringify(contract).length,
  };

  const c = report.components[id];
  console.log(
    `  ${pad(id, 12)} ${lpad(c.parts.total, 3)} parts  ${lpad(c.variants, 2)} variants  ` +
      `coverage ${derived.coverage.score}  ${lpad(c.contractBytes, 6)} bytes`,
  );
}

writeFileSync(
  join(OUT, "report.json"),
  JSON.stringify(sortKeys(report), null, 2) + "\n",
);

/* --------------------------------------------------------------- tables */

const rows = Object.entries(report.components);

console.log(`\n${"─".repeat(78)}\nANATOMY DERIVATION\n`);
console.log(
  `  ${pad("component", 12)} ${lpad("parts", 5)} ${lpad("inDflt", 7)} ${lpad("cond", 5)}   naming provenance`,
);
for (const [id, c] of rows) {
  const naming = Object.entries(c.naming)
    .sort()
    .map(([k, v]) => `${k}:${v}`)
    .join("  ");
  console.log(
    `  ${pad(id, 12)} ${lpad(c.parts.total, 5)} ${lpad(c.parts.inDefault, 7)} ${lpad(c.parts.conditional, 5)}   ${naming}`,
  );
}

console.log(
  `\n${"─".repeat(78)}\nVOCABULARY JOIN (api ↔ class ↔ tokenSegment)\n`,
);
for (const [id, c] of rows) {
  for (const a of c.axes) {
    console.log(
      `  ${pad(id, 12)} ${pad(a.prop, 14)} ${a.joined}/${a.total} joined${a.issues.length ? "   ⚠ " + a.issues.join("; ") : ""}`,
    );
  }
}

console.log(`\n${"─".repeat(78)}\nBINDING MECHANISMS\n`);
const allMech = [
  ...new Set(rows.flatMap(([, c]) => Object.keys(c.mechanisms))),
].sort();
console.log(
  `  ${pad("component", 12)} ${allMech.map((m) => lpad(m.slice(0, 11), 12)).join("")}`,
);
for (const [id, c] of rows)
  console.log(
    `  ${pad(id, 12)} ${allMech.map((m) => lpad(c.mechanisms[m] || "·", 12)).join("")}`,
  );

console.log(`\n${"─".repeat(78)}\nCOVERAGE\n`);
console.log(
  `  ${pad("component", 12)} ${lpad("score", 6)} ${lpad("proven", 7)} ${lpad("possible", 9)}   missing`,
);
for (const [id, c] of rows) {
  const missing = Object.entries(c.coverage.axes)
    .filter(([, v]) => v.missing.length)
    .map(([k, v]) => `${k}: ${v.missing.join(",")}`)
    .join("; ");
  console.log(
    `  ${pad(id, 12)} ${lpad(c.coverage.score, 6)} ${lpad(c.coverage.combinations.proven, 7)} ${lpad(c.coverage.combinations.possible, 9)}   ${missing || "—"}`,
  );
}

const failures = rows.flatMap(([id, c]) =>
  c.failedStories.map((f) => `${id}: ${f.id}`),
);
if (failures.length) {
  console.log(`\n${"─".repeat(78)}\nSTORY OBSERVATION FAILURES\n`);
  failures.forEach((f) => console.log(`  ${f}`));
}

console.log(`\n${"─".repeat(78)}\nSIZE vs SPECS OUTPUT\n`);
console.log(
  `  ${pad("component", 12)} ${lpad("contract", 9)} ${lpad("specs yaml", 11)}`,
);
for (const [id, c] of rows) {
  const specs = join(OUT, id, "reference.specs.api.yaml");
  const size = existsSync(specs) ? readFileSync(specs).length : 0;
  console.log(
    `  ${pad(id, 12)} ${lpad(c.contractBytes, 9)} ${lpad(size || "—", 11)}`,
  );
}

console.log(`\nwritten to ${OUT}\n`);
