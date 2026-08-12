/**
 * 836 — fix two real bugs in shipped client behaviour.
 *
 * `Dismissible` registers a `keydown` listener on `document` and removes only
 * the button listener in `destroy()`, so a torn-down banner keeps swallowing
 * Escape for the life of the page. And `dismiss()` has no guard, so a banner
 * that is already closed emits `dismissed` again every time the key is pressed.
 * Both are ordinary lifecycle bugs, both are invisible in a screenshot, and
 * both are the kind of thing the design system's own client modules get right.
 *
 * Unlike the rest of the suite this one drives the module rather than reading
 * it: the tests construct an instance against a jsdom element, dispatch real
 * events and count real emissions. A grep for `removeEventListener` would pass
 * a fix that removes the wrong listener, and the point of a bug-fix task is
 * whether the bug is gone.
 *
 * Two of the four behavioural tests assert things that already work — the
 * button still closes, Escape still closes a live banner. They are here
 * because the cheapest way to satisfy the bug report is to stop listening on
 * `document` altogether, which fixes the complaint and removes the feature.
 * A fix task needs the regression half or it grades demolition as repair.
 *
 * What is deliberately *not* asserted: how the second bug is guarded. A
 * `dismissed` flag, an early return on `element.hidden`, and unbinding on
 * first dismissal are all reasonable, and 861 already cost us one draft that
 * failed a legitimate answer.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { JSDOM } from "jsdom";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/dismissible",
  slug: "dismissible",
  pascal: "Dismissible",
  renderProps: {
    message: "Your export finished. The archive is available for seven days.",
    closeLabel: "Dismiss this notice",
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  component: shipped("src/components/dismissible/DismissibleComponent.tsx"),
  schema: shipped("src/components/dismissible/dismissible.schema.json"),
};

/** The markup the React component renders, as a string the tests can mount. */
const MARKUP = `
  <div class="dsa-dismissible" role="status">
    <p class="dsa-dismissible__message">Your export finished.</p>
    <button class="dsa-dismissible__close" type="button" aria-label="Dismiss">
      <span aria-hidden="true">&times;</span>
    </button>
  </div>
`;

/**
 * A banner wired up the way an application would wire one.
 *
 * Each call gets its own jsdom so a listener leaked onto `document` in one test
 * cannot reach into the next — which is exactly the failure mode under test,
 * and would otherwise show up as a mysterious result somewhere else.
 */
async function mount(): Promise<{
  element: any;
  button: any;
  instance: any;
  dismissals: () => number;
  press: (key: string) => void;
}> {
  const dom = new JSDOM(`<!doctype html><body>${MARKUP}</body>`);
  for (const name of [
    "window",
    "document",
    "CustomEvent",
    "Event",
    "HTMLElement",
  ]) {
    Object.defineProperty(globalThis, name, {
      value: name === "window" ? dom.window : (dom.window as any)[name],
      configurable: true,
      writable: true,
    });
  }

  const clientPath = harness.clientFile();
  expect(clientPath, "no client behaviour file found").toBeTruthy();

  // Through a variable on purpose: written inline the specifier is statically
  // analysable and esbuild rewrites the import into a build-time glob.
  const specifier = `./${clientPath}?t=${Math.random()}`;
  const module: Record<string, unknown> = await import(specifier);
  const Behaviour: any =
    module.default ??
    Object.values(module).find((value) => typeof value === "function");

  const element = dom.window.document.querySelector(".dsa-dismissible") as any;
  const button = dom.window.document.querySelector(
    ".dsa-dismissible__close",
  ) as any;

  let count = 0;
  element.addEventListener("dismissed", () => {
    count += 1;
  });

  return {
    element,
    button,
    instance: new Behaviour(element),
    dismissals: () => count,
    press: (key: string) =>
      dom.window.document.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key, bubbles: true }),
      ),
  };
}

/* ─────────────────────────── the reported bugs ──────────────────────────── */

test("a torn-down banner stops listening for Escape", async () => {
  const banner = await mount();
  banner.instance.destroy();
  banner.press("Escape");

  expect(banner.element.hidden).toBe(false);
  expect(banner.dismissals()).toBe(0);
});

test("a banner is dismissed at most once", async () => {
  const banner = await mount();
  banner.press("Escape");
  banner.press("Escape");
  banner.press("Escape");

  expect(banner.dismissals()).toBe(1);
});

/* ────────────────────── and the feature still works ─────────────────────── */

test("the close button still dismisses", async () => {
  const banner = await mount();
  banner.button.click();

  expect(banner.element.hidden).toBe(true);
  expect(banner.dismissals()).toBe(1);
});

test("Escape still dismisses a live banner", async () => {
  const banner = await mount();
  banner.press("Escape");

  expect(banner.element.hidden).toBe(true);
  expect(banner.dismissals()).toBe(1);
});

test("other keys are ignored", async () => {
  const banner = await mount();
  banner.press("Enter");
  banner.press("a");

  expect(banner.element.hidden).toBe(false);
  expect(banner.dismissals()).toBe(0);
});

/* ────────────────────────────── within bounds ───────────────────────────── */

test("the module keeps the shape callers depend on", async () => {
  const banner = await mount();
  expect(typeof banner.instance.destroy).toBe("function");
  expect(typeof banner.instance.dismiss).toBe("function");
});

test("the component is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});

test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("the stylesheet is left untouched", () => {
  // The brief says the markup and props are fine, and nothing about the fix
  // needs a style change.
  const styles = read(FILES.styles);
  for (const selector of ["&__message", "&__close", "&[hidden]"]) {
    expect(styles).toMatch(new RegExp(`${selector.replace(/[[\]]/g, "\\$&")}`));
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
  // Absolute, for the reason recorded in 861 (D-105): exempting `*.stories.*`
  // hides the arm most likely to leave one behind. Nothing about a two-line
  // lifecycle fix needs a new file.
  const shippedFiles = new Set([
    "DismissibleComponent.tsx",
    "Dismissible.client.js",
    "dismissible.scss",
    "dismissible.schema.json",
  ]);
  const added = readdirSync(harness.dir).filter(
    (name) => !shippedFiles.has(name),
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
