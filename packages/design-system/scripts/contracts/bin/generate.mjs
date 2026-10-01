#!/usr/bin/env node
/**
 * Generate component contracts for the whole design system.
 *
 *   node scripts/contracts/bin/generate.mjs [options]
 *
 *   --out <dir>           output root (default: contracts, committed; rollup copies it to dist/contracts)
 *   --only a,b,c          restrict generation to these component ids
 *   --emit-stories        write the declared-default stories and stop
 *   --static-only         Pass 1 only: props/tokens/axes for every subject, no browser
 *   --observations <dir>  reuse recorded observations instead of rendering
 *   --quiet               summary only
 *
 * Pass 1 (schemas, defaults, token catalogs) and Pass 3 (reconciliation) are
 * pure and browserless; Pass 2 renders the prebuilt `storybook-static` with
 * Playwright exactly as the spike does. The declared default has no authored
 * story, so one is generated per component and Storybook must be rebuilt before
 * it can be observed:
 *
 *   node scripts/contracts/bin/generate.mjs --emit-stories
 *   pnpm build-storybook
 *   node scripts/contracts/bin/generate.mjs
 *
 * The output is committed and copied to `dist/` by Rollup, exactly like the
 * screenshots under `static/`. That is what keeps `build` browserless: it never
 * generates contracts, it only ships the committed ones.
 *
 * Output (PRD §5.1, §5.1.4, §10.5, §10.6):
 *   <out>/{contractId}.contract.json     normalized v1 contract
 *   <out>/{contractId}.brief.md          lossy Markdown projection
 *   <out>/{contractId}.narrative.json    model prose sidecar, when one exists
 *   <out>/index.json                     catalog + RFC 8785 content addresses
 *   <out>/knapsack/{contractId}.contract.json + manifest.json
 *   <out>/dsds/specs.json
 *   <out>/contracts-report.json
 * `.contract-observations/{storyId}.json` holds the Pass 2 capture (gitignored)
 * and can be fed back with `--observations .contract-observations`.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { listComponents } from "../lib/components.mjs";
import { fileHash, sortKeysDeep } from "../lib/deterministic.mjs";
import { CONTRACT_FORMAT, publish } from "../lib/publish.mjs";
import { loadShared, staticPass } from "../lib/static.mjs";
import { writeDefaultStories, defaultStoryId } from "../lib/genStories.mjs";
import { observe } from "../lib/observe.mjs";
import { reconcile } from "../lib/reconcile.mjs";
import { buildBrief } from "../lib/brief.mjs";
import { foldManifest } from "../lib/fold.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const VIEWPORT = { width: 1440, height: 900 };

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] ?? true);
};

const OUT = resolve(ROOT, flag("out", "contracts"));
const ONLY = flag("only", null);
const OBSERVATIONS = flag("observations", null);
const OBS_DIR = resolve(ROOT, ".contract-observations");
const QUIET = argv.includes("--quiet");
const EMIT_STORIES = argv.includes("--emit-stories");
const STATIC_ONLY = argv.includes("--static-only");

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const CONTRACT_VERSION = String(flag("contract-version", pkg.version));

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
};

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

/* ------------------------------------------------------------- selection */

const { subjects, skipped } = listComponents(ROOT);
const selected = ONLY ? String(ONLY).split(",").map((s) => s.trim()) : subjects;

const unknown = selected.filter((id) => !subjects.includes(id));
if (unknown.length) {
  console.error(`not contract subjects: ${unknown.join(", ")}`);
  process.exit(1);
}

if (!QUIET) {
  console.log(`\nkickstartDS component contracts`);
  console.log(`  root      ${ROOT}`);
  console.log(`  out       ${OUT}`);
  console.log(`  version   ${CONTRACT_VERSION}`);
  console.log(
    `  subjects  ${selected.length}${ONLY ? ` of ${subjects.length}` : ""}`,
  );
  if (skipped.length) console.log(`  skipped   ${skipped.join(", ")}`);
  console.log("");
}

// Identity is fold-derived (PRD §5.1.2) and collisions are manifest-scoped
// (§5.1.3): gate the whole published set, not just the selection.
const identity = foldManifest(subjects.map((name) => ({ name })));
if (!identity.ok) {
  console.error("identity failure — no contracts written");
  for (const finding of identity.findings) {
    console.error(`  ${JSON.stringify(finding)}`);
  }
  process.exit(1);
}
const contractIdOf = new Map(
  identity.accepted.map((entry) => [entry.declaredName, entry.contractId]),
);

/* -------------------------------------------------------- pass 1 (static) */

if (!QUIET) console.log("Pass 1 — static extraction");
const shared = loadShared(ROOT);

const statics = new Map();
const staticFailures = [];
for (const id of subjects) {
  try {
    const pass = staticPass(ROOT, id, shared);
    // The screenshot path follows the same convention `snippets.json` uses:
    // `img/screenshots/{story-id}.png`, relative to `static/`. Recorded from
    // the story id rather than stat'ed, so the contract is a function of its
    // inputs; the file exists once the screenshot pass has rendered this story
    // (it carries the `contract-default` tag).
    const defaultStory = defaultStoryId(id);
    pass.defaultStory = {
      id: defaultStory,
      screenshot: `img/screenshots/${defaultStory}.png`,
    };
    statics.set(id, pass);
  } catch (error) {
    staticFailures.push({ id, error: String(error?.message ?? error) });
  }
}

if (STATIC_ONLY) {
  let props = 0;
  let tokens = 0;
  const rows = [];
  for (const id of selected) {
    const s = statics.get(id);
    if (!s) {
      rows.push(`  ${pad(id, 16)} FAILED`);
      continue;
    }
    props += Object.keys(s.api.props).length;
    tokens += s.tokens.length;
    const gaps = s.declared.gaps.length;
    const unparsed = s.unparsedTokens.length;
    rows.push(
      `  ${pad(id, 16)} ${lpad(Object.keys(s.api.props).length, 3)} props  ` +
        `${lpad(s.tokens.length, 3)} tokens  ${lpad(s.axes.length, 2)} axes  ` +
        `${lpad(s.stories.length, 2)} stories` +
        (unparsed ? `  ⚠ ${unparsed} unparsed` : "") +
        (gaps ? `  ⚠ ${gaps} baseline gaps` : ""),
    );
  }
  if (!QUIET) rows.forEach((row) => console.log(row));
  console.log(
    `\n  ${selected.length} subjects, ${props} props, ${tokens} tokens, ` +
      `${staticFailures.length} failure(s)`,
  );
  for (const failure of staticFailures) {
    console.log(`  ✗ ${failure.id}: ${failure.error}`);
  }
  process.exit(staticFailures.length ? 1 : 0);
}

/* ------------------------------------------- declared-default stories */

// The declared default has no authored story, so one is generated for EVERY
// subject — even when only a subset is being generated — so the checked-out
// story set never depends on which components the last run selected.
const storiesDir = writeDefaultStories(
  ROOT,
  [...statics.entries()].map(([id, s]) => ({
    id,
    config: s.declared.config,
    exportName: s.componentExport,
  })),
);
if (!QUIET) {
  console.log(
    `  wrote ${statics.size} declared-default stories to ` +
      `${storiesDir.replace(ROOT + "/", "")}/\n`,
  );
}

if (EMIT_STORIES) {
  console.log("  --emit-stories: stopping before observation\n");
  process.exit(0);
}

/* ------------------------------------------------- pass 2 (observation) */

let observations;
if (OBSERVATIONS) {
  const dir = resolve(ROOT, OBSERVATIONS);
  observations = {};
  for (const file of readdirSync(dir)) {
    if (file.endsWith(".json")) {
      observations[file.replace(/\.json$/, "")] = readJson(join(dir, file));
    }
  }
  if (!QUIET) console.log(`Pass 2 — reusing ${Object.keys(observations).length} observations from ${dir}`);
} else {
  if (!QUIET) console.log("Pass 2 — rendered observation");
  const jobs = [];
  for (const id of selected) {
    const s = statics.get(id);
    if (!s) continue;
    jobs.push({ storyId: s.defaultStory.id, tokens: s.tokens });
    for (const story of s.stories) jobs.push({ storyId: story.id, tokens: s.tokens });
  }
  observations = await observe({
    storybookDir: join(ROOT, "storybook-static"),
    jobs,
    viewport: VIEWPORT,
    onProgress: (id, ok) => {
      if (!QUIET) console.log(`  ${ok ? "ok  " : "FAIL"}  ${id}`);
    },
  });
  const obsDir = OBS_DIR;
  mkdirSync(obsDir, { recursive: true });
  for (const [storyId, obs] of Object.entries(observations)) {
    writeJson(join(obsDir, `${storyId}.json`), obs);
  }
  if (!QUIET) {
    console.log(
      `  captured ${Object.keys(observations).length} observations → ` +
        `${obsDir.replace(ROOT + "/", "")}/`,
    );
  }
}

/* ------------------------------------------------ pass 3 (reconciliation) */

// Observations that never settled. An unstable capture is a weaker contract,
// so it is reported rather than silently embedded (PRD §5.10).
const unstableObservations = Object.entries(observations)
  .filter(([, observation]) => observation.unstable)
  .map(([storyId]) => storyId)
  .sort();

if (!QUIET) console.log("\nPass 3 — reconciliation");
const contracts = [];
const componentReports = [];
const unrenderable = [];
let reconcileFailures = 0;

for (const id of selected) {
  const s = statics.get(id);
  if (!s) continue;

  const derived = reconcile(s, observations);
  if (derived.error) {
    // A component whose declared default renders nothing cannot be derived —
    // there is no DOM to observe. That is a recorded limitation, not a
    // regression, and the contract is skipped rather than invented.
    if (derived.error.startsWith("declared default not observed")) {
      unrenderable.push(id);
      componentReports.push({ id, skipped: derived.error });
      if (!QUIET) console.log(`  ${pad(id, 16)} SKIP ${derived.error}`);
      continue;
    }
    reconcileFailures++;
    if (!QUIET) console.log(`  ${pad(id, 16)} ERROR ${derived.error}`);
    componentReports.push({ id, error: derived.error });
    continue;
  }

  const dir = join(ROOT, "src/components", id);
  const contractId = contractIdOf.get(id);
  const contract = sortKeysDeep({
    $format: CONTRACT_FORMAT,
    contractId,
    component: s.title,
    description: s.description,
    generated: {
      inputs: {
        schema: fileHash(join(dir, `${id}.schema.dereffed.json`)),
        tokens: fileHash(join(ROOT, "src/token/component-token-catalog.json")),
        stories: fileHash(join(ROOT, "snippets.json")),
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

  contracts.push(contract);
  writeJson(join(OUT, `${contractId}.contract.json`), contract);

  // Pass 4 (§5.12) is out of band: the narrative is a separate, model-generated
  // sidecar. It is committed in the contract set like the screenshots, so read
  // it from there first (and preserve it — `contracts:verify` excludes it from
  // the reproducibility diff, since model output cannot be reproduced).
  const narrative = (() => {
    try {
      return readJson(join(OUT, `${contractId}.narrative.json`));
    } catch {
      try {
        return readJson(join(dir, `${id}.narrative.json`));
      } catch {
        return null;
      }
    }
  })();
  if (narrative) writeJson(join(OUT, `${contractId}.narrative.json`), narrative);
  writeFileSync(join(OUT, `${contractId}.brief.md`), buildBrief(contract, narrative));

  componentReports.push({
    id,
    contractId,
    component: s.title,
    props: Object.keys(s.api.props).length,
    tokens: s.tokens.length,
    stories: s.stories.length,
    variants: derived.variants.length,
    mechanisms: derived.bindings.reduce((acc, binding) => {
      acc[binding.mechanism] = (acc[binding.mechanism] || 0) + 1;
      return acc;
    }, {}),
    coverage: derived.coverage,
    issues: derived.issues,
    failedStories: derived.failed,
    bytes: JSON.stringify(contract).length,
  });

  if (!QUIET) {
    console.log(
      `  ${pad(id, 16)} ${lpad(derived.coverage.parts.total, 3)} parts  ` +
        `${lpad(derived.variants.length, 2)} variants  ` +
        `coverage ${derived.coverage.score}  ` +
        `${lpad(JSON.stringify(contract).length, 6)} bytes`,
    );
  }
}

/* ------------------------------------------ identity, integrity, projections */

const result = publish(contracts, { contractVersion: CONTRACT_VERSION });
if (!result.ok) {
  console.error("\npublish failed — no projections written");
  for (const finding of result.findings) console.error(`  ${JSON.stringify(finding)}`);
  process.exit(1);
}

writeJson(join(OUT, "index.json"), result.index);
for (const { contractId, json } of result.knapsack.contracts) {
  writeJson(join(OUT, "knapsack", `${contractId}.contract.json`), json);
}
writeJson(join(OUT, "knapsack", "manifest.json"), result.knapsack.manifest);
writeJson(join(OUT, "dsds", "specs.json"), result.dsds);

writeJson(join(OUT, "contracts-report.json"), {
  format: CONTRACT_FORMAT,
  contractVersion: CONTRACT_VERSION,
  viewport: VIEWPORT,
  skipped: skipped,
  unrenderable,
  unstableObservations,
  staticFailures,
  components: componentReports.sort((a, b) => (a.id < b.id ? -1 : 1)),
  projectionLosses: result.losses.length,
});

/* --------------------------------------------------------------- summary */

if (!QUIET) {
  const scored = componentReports.filter((c) => c.coverage);
  const meanCoverage = scored.length
    ? (
        scored.reduce((sum, c) => sum + (c.coverage.score ?? 0), 0) / scored.length
      ).toFixed(3)
    : "n/a";
  const failures = componentReports.flatMap((c) =>
    (c.failedStories ?? []).map((f) => `${c.id}: ${f.id}`),
  );
  const unresolved = contracts.flatMap((contract) =>
    (contract.issues ?? []).map((issue) => `${contract.contractId}: ${issue.code}`),
  );

  console.log(`\n${"─".repeat(78)}`);
  console.log(`  contracts    ${contracts.length}/${selected.length}`);
  console.log(`  mean coverage ${meanCoverage}`);
  console.log(`  knapsack     ${result.knapsack.contracts.length} contracts + manifest`);
  console.log(`  dsds         ${result.dsds.components.length} component entries`);
  console.log(`  losses       ${result.losses.length}`);
  if (staticFailures.length) console.log(`  static fail  ${staticFailures.length}`);
  if (reconcileFailures) console.log(`  reconcile fail ${reconcileFailures}`);
  if (unrenderable.length) {
    console.log(
      `  unrenderable ${unrenderable.length} (declared default renders nothing: ${unrenderable.join(", ")})`,
    );
  }
  if (unstableObservations.length) {
    console.log(
      `  ⚠ unstable   ${unstableObservations.length} observation(s) never settled: ${unstableObservations.slice(0, 6).join(", ")}${unstableObservations.length > 6 ? ", …" : ""}`,
    );
  }
  if (failures.length) {
    console.log(`\n  story observation failures:`);
    failures.forEach((f) => console.log(`    ${f}`));
  }
  if (unresolved.length) {
    console.log(`\n  contract issues:`);
    unresolved.forEach((i) => console.log(`    ${i}`));
  }
  console.log(`\nwritten to ${OUT}\n`);
}

process.exit(reconcileFailures || staticFailures.length ? 1 : 0);
