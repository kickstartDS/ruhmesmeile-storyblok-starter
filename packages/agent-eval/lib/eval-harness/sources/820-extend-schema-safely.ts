/**
 * 820 — add an option to a published component without moving anyone's cheese.
 *
 * The constructive mirror of 862. There the task was to leave an API alone;
 * here it is to extend one, and the interesting failure is the same shape:
 * making the new thing required, or making it change what existing callers
 * already get. A `size` prop that has no default, or that is added to the
 * schema's `required` array, is a correct-looking answer that breaks every
 * call site in the codebase — and nothing in a screenshot shows it.
 *
 * The house convention for this is specific and checkable: optional in
 * TypeScript, defaulted in the component, declared in the schema with a
 * `default`, and expressed as a BEM modifier rather than a second component.
 * `component-builder` hands out all four; this task asks whether holding it
 * changes the answer.
 *
 * The tests render twice — once the way an existing caller does, once with the
 * new option — because the only way to tell a real variant from a prop that is
 * accepted and ignored is to look at what comes out. A static read of the
 * source would pass a `size` that is destructured and never used.
 *
 * What is deliberately *not* asserted: the modifier's name, the second size
 * value's name, or which file the modifier's styles live in. Only that the
 * default render is unchanged and the compact render is different.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { JSDOM } from "jsdom";

import { captureTranscript, createHarness } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/avatar",
  slug: "avatar",
  pascal: "Avatar",
  renderProps: {
    name: "Ada Lovelace",
    imageSrc: "/img/ada.png",
  },
});

const { files: FILES, read, toolchainReport } = harness;

const schema = () => JSON.parse(read(FILES.schema));

/**
 * Render the component the way a caller would, and hand back the root element.
 *
 * The harness renders once with fixed props; this task needs two renders with
 * different ones, so it does its own. Same shape as the harness's probe,
 * including the variable import specifier — written inline the specifier is
 * statically analysable and esbuild rewrites it into a build-time glob.
 */
async function render(props: Record<string, unknown>): Promise<any> {
  const dom = new JSDOM("<!doctype html><body></body>");
  for (const name of ["window", "document", "navigator", "HTMLElement"]) {
    Object.defineProperty(globalThis, name, {
      value: name === "window" ? dom.window : (dom.window as any)[name],
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    value: true,
    configurable: true,
    writable: true,
  });

  const React: any = await import("react");
  const { createRoot } = await import("react-dom/client");

  const specifier = `./${FILES.component}`;
  const module: Record<string, unknown> = await import(specifier);

  const isRenderable = (value: unknown): boolean => {
    if (typeof value === "function") return true;
    if (typeof value !== "object" || value === null) return false;
    const tag = (value as { $$typeof?: symbol }).$$typeof;
    return (
      typeof tag === "symbol" &&
      /react\.(forward_ref|memo)/.test(String(tag.description))
    );
  };

  const candidate = [
    module.Avatar,
    module.default,
    ...Object.values(module),
  ].find(isRenderable);

  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);

  const act = React.act ?? (async (fn: () => unknown) => void (await fn()));
  await act(async () => {
    createRoot(container).render(React.createElement(candidate as any, props));
  });

  return container.firstElementChild;
}

const BASE = { name: "Ada Lovelace", imageSrc: "/img/ada.png" };

/** Class names on an element, as a set. */
function classes(element: any): Set<string> {
  return new Set(
    String(element?.className ?? "")
      .split(/\s+/)
      .filter(Boolean),
  );
}

/* ────────────────────────── the option exists ───────────────────────────── */

test("the component accepts a size", () => {
  const source = read(FILES.component);
  expect(source).toMatch(/\bsize\?\s*:/);
  expect(source).toMatch(/["']compact["']/);
});

test("the schema declares the size", () => {
  const size = schema().properties?.size;
  expect(size, "no `size` property in the schema").toBeTruthy();
  expect(JSON.stringify(size)).toContain("compact");
});

test("the compact size renders differently", async () => {
  const regular = classes(await render(BASE));
  const compact = classes(await render({ ...BASE, size: "compact" }));

  expect(compact).not.toEqual(regular);
  // Both are still the same component. Not a superset check: the idiomatic
  // answer emits `dsa-avatar--regular` for the default, so the default's class
  // list is *not* contained in the compact one, and an earlier draft of this
  // assertion failed the reference solution for it.
  expect(regular.has("dsa-avatar")).toBe(true);
  expect(compact.has("dsa-avatar")).toBe(true);
});

test("the size has a place in the stylesheet", () => {
  expect(read(FILES.styles)).toMatch(/&--/);
});

/* ─────────────────────── and nobody has to be told ──────────────────────── */

test("the size is optional in TypeScript", () => {
  // `size?:` above, and no non-null assertion smuggling it back in. Existing
  // call sites pass neither `size` nor anything else new.
  expect(read(FILES.component)).not.toMatch(/\bsize\s*:/);
});

test("the size is optional in the schema", () => {
  expect(schema().required).toEqual(["name"]);
});

test("the size has a default", () => {
  // Both halves, because either alone leaves a caller with a different render:
  // a schema default the component ignores, or a component default the CMS
  // does not know about.
  expect(schema().properties.size).toHaveProperty("default");
  expect(read(FILES.component)).toMatch(/size\s*=\s*["'][a-z]+["']/i);
});

test("an existing call site renders as it did", async () => {
  const root = await render(BASE);
  const html = String(root?.outerHTML ?? "");

  expect(classes(root).has("dsa-avatar")).toBe(true);
  expect(html).toContain("dsa-avatar__image");
  expect(html).toContain("dsa-avatar__name");
  expect(html).toContain("Ada Lovelace");
});

/* ────────────────────────────── within bounds ───────────────────────────── */

test("the rest of the API is untouched", () => {
  const properties = schema().properties;
  expect(Object.keys(properties).sort()).toEqual(["imageSrc", "name", "size"]);
  expect(schema().additionalProperties).toBe(false);
});

test("the shipped styles are not rewritten", () => {
  // Adding a modifier is the task; restyling the base is not. The digest is
  // not pinned — the file has to change — so the shipped rules are pinned
  // instead.
  const styles = read(FILES.styles);
  for (const selector of ["&__image", "&__initials", "&__name"]) {
    expect(styles).toMatch(new RegExp(`${selector}(?![\\w-])`));
  }
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});

test("no unrelated files are added to the component", () => {
  // Absolute apart from stylesheets, for the reason recorded in 861 (D-105).
  const shippedFiles = new Set([
    "AvatarComponent.tsx",
    "avatar.scss",
    "avatar.schema.json",
  ]);
  const added = readdirSync(harness.dir).filter(
    (name) => !shippedFiles.has(name) && !name.endsWith(".scss"),
  );
  expect(added).toEqual([]);
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
  expect(runtime.violations).toEqual([]);
  expect(existsSync(harness.reportFiles.toolchain)).toBe(true);
  expect(existsSync(harness.reportFiles.runtime)).toBe(true);
});
