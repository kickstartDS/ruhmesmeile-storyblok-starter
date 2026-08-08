/**
 * Screenshotting the component a trial produced.
 *
 * The report already renders that component live and interactively, which is
 * the better artifact — but it costs a browser, a served directory and a few
 * seconds. A PNG costs a URL. That difference is what makes the results index
 * (2.8) able to show sixty trials side by side, and it is what makes a review
 * comparable a year later, when a component's dependencies no longer install.
 *
 * Two things are worth being explicit about:
 *
 * A blank screenshot is a *result*, not a failure. Plenty of trials produce a
 * component that renders as nothing, and the whole point of a review artifact
 * is to show that rather than hide it behind an error. So an empty or
 * zero-sized root falls back to a viewport shot and says so in `note`, and the
 * capture still succeeds.
 *
 * Determinism is bounded on purpose. Animations are disabled and fonts are
 * awaited, which removes the two large sources of frame-to-frame noise. These
 * are review artifacts, not visual-regression baselines: nothing compares them
 * byte-for-byte, so chasing the last few pixels would buy nothing.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Browser } from "playwright-core";

import { serveDirectory } from "./serve";

/** The stories worth a picture. The rest of the report is prose. */
const STORIES = [{ id: "report-component--rendered", file: "component.png" }];

const VIEWPORT = { width: 1200, height: 800 };

/** Breathing room around the component, so it is not cropped to its own edge. */
const PADDING = 24;

export interface Shot {
  story: string;
  /** Path relative to the run directory, so it survives being moved. */
  path: string;
  note?: string;
}

/**
 * The produced component, as a bounding box.
 *
 * Measured from `.rp-stage` — the element the Rendered story mounts the
 * component into — rather than from `#storybook-root`, because the stage is a
 * full-width block and its box says nothing about how big the component is. A
 * badge measured that way comes out as a 1200×250 picture of mostly nothing.
 *
 * The *union* of the stage's children, not the first of them: a component may
 * legitimately render several roots, and cropping to the first would silently
 * cut the rest off. Children without a layout box are skipped, which is also
 * how the design system's hidden icon sprite is excluded when the fallback
 * root is used.
 *
 * Written as an immediately-invoked expression because `page.evaluate` given a
 * string *evaluates* it rather than calling it: a bare arrow function comes
 * back as an unserialisable value, which reads exactly like a component that
 * rendered nothing. It cost one confidently wrong screenshot to notice.
 */
const COMPONENT_BOX = `(() => {
  const stage =
    document.querySelector(".rp-stage") ??
    document.querySelector("#storybook-root");
  if (!stage) return null;

  let union = null;
  for (const child of stage.children) {
    const box = child.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    union = union
      ? {
          left: Math.min(union.left, box.left),
          top: Math.min(union.top, box.top),
          right: Math.max(union.right, box.right),
          bottom: Math.max(union.bottom, box.bottom),
        }
      : { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }

  return union
    ? {
        x: union.left,
        y: union.top,
        width: union.right - union.left,
        height: union.bottom - union.top,
      }
    : null;
})()`;

async function captureStory(
  browser: Browser,
  origin: string,
  storyId: string,
  destination: string,
): Promise<string | undefined> {
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    // Anything that respects the preference stops moving, which is most of it.
    reducedMotion: "reduce",
  });

  try {
    await page.goto(`${origin}/iframe.html?id=${storyId}&viewMode=story`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("#storybook-root", { timeout: 15_000 });

    // The component's own client behaviour hydrates via MutationObserver, and
    // web fonts change every measurement in the shot. Wait for both.
    await page.evaluate("document.fonts.ready");

    // The token layer defines the page background; without it an element shot
    // comes out transparent and reads as a rendering fault in every viewer.
    await page.addStyleTag({
      content:
        "html, body { background: var(--ks-background-color-default, #fff); }",
    });

    const box = (await page.evaluate(COMPONENT_BOX)) as {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null;

    if (!box) {
      await page.screenshot({ path: destination, animations: "disabled" });
      return "the component rendered nothing with a layout box";
    }

    await page.screenshot({
      path: destination,
      animations: "disabled",
      clip: {
        x: Math.max(0, box.x - PADDING),
        y: Math.max(0, box.y - PADDING),
        width: Math.min(VIEWPORT.width, box.width + PADDING * 2),
        height: Math.min(VIEWPORT.height, box.height + PADDING * 2),
      },
    });
    return undefined;
  } finally {
    await page.close();
  }
}

/**
 * Captures every screenshot for one built trial.
 *
 * `runDir` must already contain `storybook-static`; this does not build it.
 */
export async function captureScreenshots(runDir: string): Promise<Shot[]> {
  const outputDir = join(runDir, "screenshots");
  mkdirSync(outputDir, { recursive: true });

  const server = await serveDirectory(join(runDir, "storybook-static"));
  const browser = await chromium.launch();

  try {
    const shots: Shot[] = [];
    for (const story of STORIES) {
      const note = await captureStory(
        browser,
        server.origin,
        story.id,
        join(outputDir, story.file),
      );
      shots.push({
        story: story.id,
        path: join("screenshots", story.file),
        ...(note ? { note } : {}),
      });
    }
    return shots;
  } finally {
    await browser.close();
    await server.close();
  }
}
