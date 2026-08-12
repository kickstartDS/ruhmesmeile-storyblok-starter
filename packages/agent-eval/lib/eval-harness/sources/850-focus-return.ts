/**
 * 850 — the keyboard has to be able to leave again.
 *
 * `FilterFlyout` toggles `aria-expanded` correctly and the stylesheet reveals
 * the panel off that attribute, so by every check the suite already runs this
 * component works: 832's assertions pass on it as shipped. What it does not do
 * is move focus into the panel it just opened, close on Escape, or hand focus
 * back to the trigger — the three things `NavToggle.client.js` in the real
 * design system does and the reason it is usable without a mouse.
 *
 * `mcpUseExpected` is false, and deliberately. Neither server says a word about
 * focus, Escape or keyboard behaviour — `grep -c 'focus\|Escape\|aria-' ` over
 * `component-builder-mcp/src` returns zero on every file. This is the suite's
 * second control alongside 852, and a better one: the client-behaviour template
 * *is* in the server, so an agent holding it will be pulled into calling a tool
 * that has nothing to offer on the actual question. A treatment effect here
 * would be measuring something other than the documentation.
 *
 * Driven rather than read, per 836: a grep for `.focus()` passes an
 * implementation that focuses the wrong thing at the wrong time.
 *
 * Three of the assertions cover behaviour that already works. The cheapest way
 * to satisfy a bug report about a panel you cannot escape is to stop opening
 * it, and a fix task without a regression half grades demolition as repair.
 *
 * See lib/eval-harness/sources/ for why this is not in the fixture.
 */

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { JSDOM } from "jsdom";

import { captureTranscript, createHarness, shipped } from "../harness";

captureTranscript();

const harness = createHarness({
  dir: "src/components/filter-flyout",
  slug: "filter-flyout",
  pascal: "FilterFlyout",
  renderProps: {
    id: "results-filter",
    triggerLabel: "Filter results",
    flyoutOptions: [
      { id: "recent", label: "Most recent" },
      { id: "popular", label: "Most read" },
      { id: "az", label: "A to Z" },
    ],
  },
});

const { files: FILES, read, digest, toolchainReport } = harness;

const SHIPPED = {
  component: shipped("src/components/filter-flyout/FilterFlyoutComponent.tsx"),
  styles: shipped("src/components/filter-flyout/filter-flyout.scss"),
  tokens: shipped("src/components/filter-flyout/_filter-flyout-tokens.scss"),
  schema: shipped("src/components/filter-flyout/filter-flyout.schema.json"),
};

/** The markup the React component renders, as a string the tests can mount. */
const MARKUP = `
  <div class="dsa-filter-flyout" id="results-filter">
    <button class="dsa-filter-flyout__trigger" type="button"
            aria-expanded="false" aria-controls="results-filter-panel">
      Filter results
    </button>
    <div class="dsa-filter-flyout__panel" id="results-filter-panel"
         tabindex="-1" aria-label="Filter results">
      <ul class="dsa-filter-flyout__options">
        <li class="dsa-filter-flyout__option">
          <a class="dsa-filter-flyout__link" href="?filter=recent">Most recent</a>
        </li>
        <li class="dsa-filter-flyout__option">
          <a class="dsa-filter-flyout__link" href="?filter=popular">Most read</a>
        </li>
      </ul>
    </div>
  </div>
`;

/**
 * A flyout wired up the way an application would wire one.
 *
 * Each call gets its own jsdom so a listener leaked onto `document` in one test
 * cannot reach into the next.
 */
async function mount(): Promise<{
  trigger: any;
  panel: any;
  instance: any;
  isOpen: () => boolean;
  active: () => any;
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

  const root = dom.window.document.querySelector(".dsa-filter-flyout") as any;
  const trigger = dom.window.document.querySelector(
    ".dsa-filter-flyout__trigger",
  ) as any;
  const panel = dom.window.document.querySelector(
    ".dsa-filter-flyout__panel",
  ) as any;

  return {
    trigger,
    panel,
    instance: new Behaviour(root),
    isOpen: () => trigger.getAttribute("aria-expanded") === "true",
    active: () => dom.window.document.activeElement,
    press: (key: string) =>
      dom.window.document.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key, bubbles: true }),
      ),
  };
}

/* ─────────────────────────── what was reported ──────────────────────────── */

test("opening the flyout puts the keyboard inside it", async () => {
  const { trigger, panel, active } = await mount();

  trigger.click();

  const focused = active();
  expect(
    focused === panel || panel.contains(focused),
    "focus stayed outside the panel after opening",
  ).toBe(true);
});

test("Escape closes the flyout", async () => {
  const { trigger, isOpen, press } = await mount();

  trigger.click();
  expect(isOpen()).toBe(true);

  press("Escape");
  expect(isOpen()).toBe(false);
});

test("closing hands the keyboard back to the trigger", async () => {
  const { trigger, active, press } = await mount();

  trigger.click();
  press("Escape");

  expect(active()).toBe(trigger);
});

test("closing from the trigger also hands focus back", async () => {
  // Clicking the trigger a second time is the other way out, and it strands
  // the caret just as thoroughly if only the Escape path was wired up.
  const { trigger, isOpen, active } = await mount();

  trigger.click();
  trigger.click();

  expect(isOpen()).toBe(false);
  expect(active()).toBe(trigger);
});

/* ─────────────────────────── what already worked ────────────────────────── */

test("the trigger still opens the flyout", async () => {
  const { trigger, isOpen } = await mount();

  expect(isOpen()).toBe(false);
  trigger.click();
  expect(isOpen()).toBe(true);
});

test("keys other than Escape are ignored", async () => {
  const { trigger, isOpen, press } = await mount();

  trigger.click();
  for (const key of ["a", "Enter", "ArrowDown", " "]) press(key);

  expect(isOpen()).toBe(true);
});

test("a torn-down flyout stops listening", async () => {
  // Whatever gets bound to close on Escape has to come off in `destroy()`, or
  // the page keeps swallowing the key for the life of the session — the bug
  // 836 exists to punish, one component over.
  const { trigger, isOpen, instance, press } = await mount();

  trigger.click();
  instance.destroy();
  press("Escape");

  expect(isOpen()).toBe(true);
});

/* ──────────────────────────── nothing else moves ────────────────────────── */

test("the component is left untouched", () => {
  expect(digest(FILES.component)).toBe(SHIPPED.component);
});

test("the stylesheet is left untouched", () => {
  expect(digest(FILES.styles)).toBe(SHIPPED.styles);
  expect(
    digest("src/components/filter-flyout/_filter-flyout-tokens.scss"),
  ).toBe(SHIPPED.tokens);
});

test("the schema is left untouched", () => {
  expect(digest(FILES.schema)).toBe(SHIPPED.schema);
});

test("the client module stays framework-free", () => {
  const client = read(harness.clientFile()!);
  expect(client).not.toMatch(/from\s+["']react/);
  expect(client).not.toContain("useState");
});

test("no dependencies are added", () => {
  const manifest = JSON.parse(read("package.json"));
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    "react",
    "react-dom",
  ]);
});

test("no unrelated files are added to the component", () => {
  const allowed = new Set([
    "FilterFlyoutComponent.tsx",
    "filter-flyout.scss",
    "_filter-flyout-tokens.scss",
    "filter-flyout.schema.json",
    "FilterFlyout.client.js",
  ]);
  const added = readdirSync(harness.dir).filter((name) => !allowed.has(name));
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
