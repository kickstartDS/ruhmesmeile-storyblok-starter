/**
 * 804 — documenting a component the way the house does it.
 *
 * Every other task in the suite measures whether an arm can write a component.
 * None measures whether it can write the *documentation* that ships with one,
 * and in this design system that is not a generic Storybook question. 58 of the
 * 73 components spread `getArgsShared(schema)` into their meta, 40 hand their
 * extracted tokens to a `cssprops` parameter, and every one of them packs its
 * args into the dotted keys Storybook controls address. None of that is
 * guessable from Storybook's own documentation — it is house convention,
 * encoded in `get-storybook-template`, and an arm without that server has no
 * way to arrive at it except by inference from the artefacts lying in the
 * component directory.
 *
 * Which makes this the cleanest MCP-knowledge probe in the suite: the correct
 * answer is specific, it is documented in exactly one place, and a competent
 * agent working without that place will write a perfectly good story that fails
 * most of these assertions.
 *
 * The component ships finished. This is a documentation task, so the restraint
 * half pins the component, its stylesheet and its schema artefacts.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/price-tag",
  slug: "price-tag",
  pascal: "PriceTag",
  renderProps: {
    amount: "€49",
    period: "month",
    variant: "highlight",
    note: { text: "Billed annually", emphasis: true },
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const STORY_FILE = `${harness.dir}/PriceTag.stories.tsx`;
const DOC_FILE = `${harness.dir}/PriceTag.mdx`;

const SHIPPED = {
  component: shipped("src/components/price-tag/PriceTagComponent.tsx"),
  styles: shipped("src/components/price-tag/price-tag.scss"),
  tokens: shipped("src/components/price-tag/_price-tag-tokens.scss"),
  schema: shipped("src/components/price-tag/price-tag.schema.json"),
  dereffed: shipped("src/components/price-tag/price-tag.schema.dereffed.json"),
  tokensJson: shipped("src/components/price-tag/price-tag-tokens.json"),
};

/** Every leaf prop the schema declares, in the dotted form controls use. */
const DOCUMENTED_PROPS = ["amount", "note.text", "period", "variant"];

/**
 * The story module, loaded once.
 *
 * Imported rather than read: a story file is a module that either evaluates to
 * the right object or does not, and the difference between spreading
 * `getArgsShared(schema)` and typing out a plausible-looking `argTypes` literal
 * is invisible to a regex but obvious to `===`.
 *
 * The specifier goes through a variable for the reason recorded in 820: written
 * inline, esbuild rewrites it into a build-time glob and the import resolves
 * against the wrong root.
 */
async function storyModule(): Promise<Record<string, any>> {
  const specifier = `./${STORY_FILE}`;
  return await import(specifier);
}

/** Named story exports, i.e. everything but the default meta. */
async function stories(): Promise<Record<string, any>> {
  const module = await storyModule();
  return Object.fromEntries(
    Object.entries(module).filter(
      ([name, value]) =>
        name !== "default" && value !== null && typeof value === "object",
    ),
  );
}

/** Args as Storybook would see them: meta defaults overlaid with the story's. */
async function argsPerStory(): Promise<Record<string, unknown>[]> {
  const module = await storyModule();
  const metaArgs = module.default?.args ?? {};
  return Object.values(await stories()).map((story) => ({
    ...metaArgs,
    ...(story.args ?? {}),
  }));
}

const isPlainObject = (value: unknown) =>
  Object.prototype.toString.call(value) === "[object Object]";

/* ────────────────────────────── the documentation ───────────────────────── */

test("the component has a story file", () => {
  expect(existsSync(STORY_FILE)).toBe(true);
});

test("the story documents this component", async () => {
  const module = await storyModule();
  const specifier = `./${FILES.component}`;
  const componentModule: Record<string, unknown> = await import(specifier);

  // Either the context-aware wrapper or the default implementation — the
  // template names the wrapper, but pointing Storybook at the concrete
  // component is a defensible reading and not what this task is about.
  expect(Object.values(componentModule)).toContain(module.default?.component);
});

test("the story is filed where the component library looks for it", async () => {
  const module = await storyModule();
  expect(module.default?.title).toMatch(/^Components\/PriceTag$/);
});

test("the schema is wired into the story's parameters", async () => {
  // `jsonschema` drives the props table. Without it the component's own API
  // documentation is simply missing from the docs page.
  const module = await storyModule();
  expect(module.default?.parameters?.jsonschema?.schema).toEqual(
    JSON.parse(read(`${harness.dir}/price-tag.schema.dereffed.json`)),
  );
});

test("the component's tokens are wired into the story's parameters", async () => {
  // `cssprops` drives the token panel — the half of the docs page that tells a
  // consumer which custom properties they are allowed to override.
  const module = await storyModule();
  expect(module.default?.parameters?.cssprops?.customProperties).toEqual(
    JSON.parse(read(`${harness.dir}/price-tag-tokens.json`)),
  );
});

test("the controls are derived from the schema rather than restated by hand", async () => {
  const { getArgsShared } = await import(
    "@kickstartds/core/lib/storybook" as string
  );
  const expected = Object.keys(
    getArgsShared(
      JSON.parse(read(`${harness.dir}/price-tag.schema.dereffed.json`)),
    ).argTypes,
  ).sort();

  const module = await storyModule();
  const actual = Object.keys(module.default?.argTypes ?? {});

  // A superset, not an equality: adding a control the schema cannot express is
  // legitimate. Restating the schema's own controls by hand is what fails here,
  // and it fails because hand-written ones never reproduce the full key set.
  expect(expected.filter((key) => !actual.includes(key))).toEqual([]);
});

test("at least one story is exported", async () => {
  expect(Object.keys(await stories()).length).toBeGreaterThan(0);
});

test("every documented prop reaches the controls", async () => {
  // A docs page that only ever shows `amount` documents a quarter of the
  // component. Satisfied for free by spreading the schema-derived args.
  const seen = new Set<string>();
  for (const args of await argsPerStory()) {
    Object.keys(args).forEach((key) => seen.add(key));
  }
  expect(DOCUMENTED_PROPS.filter((prop) => !seen.has(prop))).toEqual([]);
});

test("story args are flattened for the controls", async () => {
  // Storybook controls are flat: one control, one key. A nested object reaches
  // the component but arrives in the controls panel as an uneditable blob, so
  // the house packs args into dotted keys instead.
  for (const args of await argsPerStory()) {
    const nested = Object.entries(args)
      .filter(([, value]) => isPlainObject(value))
      .map(([key]) => key);
    expect(nested).toEqual([]);
  }
});

test("the documentation page is written", async () => {
  expect(existsSync(DOC_FILE)).toBe(true);
  expect(read(DOC_FILE)).toContain("PriceTag.stories");
});

/* ────────────────────────────── within bounds ───────────────────────────── */

test("the component is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});

test("the stylesheet and its token layer are left untouched", () => {
  expect(digest(FILES.styles)).toBe(SHIPPED.styles);
  expect(digest(`${harness.dir}/_price-tag-tokens.scss`)).toBe(SHIPPED.tokens);
});

test("the schema and its build artefacts are left untouched", () => {
  // The dereffed schema and the token JSON are generated by the build. Editing
  // one to make a story tidier desynchronises it from its source and the next
  // build silently reverts the change.
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
  expect(digest(`${harness.dir}/price-tag.schema.dereffed.json`)).toBe(
    SHIPPED.dereffed,
  );
  expect(digest(`${harness.dir}/price-tag-tokens.json`)).toBe(
    SHIPPED.tokensJson,
  );
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "@kickstartds/core",
    "react",
    "react-dom",
  ]);
});

test("no unrelated files are added to the component", () => {
  const allowed = new Set([
    "PriceTagComponent.tsx",
    "price-tag.scss",
    "_price-tag-tokens.scss",
    "price-tag.schema.json",
    "price-tag.schema.dereffed.json",
    "price-tag-tokens.json",
    // The two files this task asks for.
    "PriceTag.stories.tsx",
    "PriceTag.mdx",
  ]);
  expect(readdirSync(harness.dir).filter((name) => !allowed.has(name))).toEqual(
    [],
  );
});

/* ────────────────────────────── still healthy ───────────────────────────── */

test("the package typechecks", () => {
  expect(toolchainReport.typecheck.detail).toBe("");
});

test("the stylesheet compiles", () => {
  expect(toolchainReport.styles.detail).toBe("");
});

test("toolchain and runtime reports are written for host-side grading", async () => {
  const runtime = await harness.writeRuntimeReport();

  expect(runtime.rendered).toBe(true);
  expect(existsSync(harness.reportFiles.toolchain)).toBe(true);
  expect(existsSync(harness.reportFiles.runtime)).toBe(true);
});
