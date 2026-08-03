/**
 * Pass 2 — Rendered observation.
 *
 * Mirrors what the real implementation would do inside `postVisit` in
 * .storybook/test-runner.tsx, where a Playwright `page` is already available
 * and every story is already rendered for screenshot capture. Here we drive
 * the prebuilt `storybook-static` directly so the spike can run standalone.
 *
 * For each story we record, per DOM node:
 *   - tag, classes, contract-relevant attributes, leaf text
 *   - a FIXED, ORDERED set of computed style properties (determinism)
 *   - which `--dsa-*` tokens are *defined* on that node, and to what.
 *     Custom properties inherit, so "defined here" is detected by comparing a
 *     node's computed value against its parent's. This is what locates a token
 *     on an actual part rather than trusting its name.
 *   - the bounding box
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium } from "playwright";

/** Fixed and ordered — never enumerate getComputedStyle. */
export const OBSERVED_PROPERTIES = [
  "display",
  "flex-direction",
  "justify-content",
  "align-items",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "position",
  "width",
  "height",
  "min-height",
  "max-width",
  "aspect-ratio",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-bottom",
  "color",
  "background-color",
  "background-image",
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-top-left-radius",
  "box-shadow",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-decoration-line",
  "text-align",
  "overflow-x",
  "pointer-events",
  "transition-duration",
];

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

function serve(rootDir) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let p = join(rootDir, decodeURIComponent(url.pathname));
      if (!p.startsWith(rootDir)) return res.writeHead(403).end();
      if (existsSync(p) && !extname(p)) p = join(p, "index.html");
      const body = await readFile(p);
      res.writeHead(200, {
        "Content-Type": MIME[extname(p)] || "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, port: server.address().port })
    );
  });
}

/** Runs in the browser. Kept self-contained — no closure over Node scope. */
/* c8 ignore start */
function walkPage({ properties, tokens }) {
  const MAX_DEPTH = 12;
  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const KEEP_ATTR =
    /^(disabled|type|role|aria-[a-z-]+|data-[a-z-]+|target|rel|open|checked|selected)$/;
  // Values that change on every render carry no contractual meaning.
  const VOLATILE_ATTR = /^(data-uid|id|aria-controls|aria-labelledby|aria-describedby)$/;
  // The static server binds an ephemeral port; make URLs origin-relative.
  const stable = (v) =>
    typeof v === "string"
      ? v.replace(new RegExp(location.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "")
      : v;

  const root = document.querySelector("#storybook-root");
  if (!root) return null;

  // Storybook injects the icon sprite as a hidden <svg> before the story.
  const candidates = [...root.children].filter(
    (el) => !el.hasAttribute("hidden") && el.tagName.toLowerCase() !== "style"
  );
  const componentRoot = candidates[0];
  if (!componentRoot) return null;

  const walk = (el, parentTokenValues, depth) => {
    const cs = getComputedStyle(el);

    const styles = {};
    for (const p of properties) styles[camel(p)] = stable(cs.getPropertyValue(p).trim());

    // Locate tokens: a token is "defined here" when its declared value differs
    // from the value inherited from the parent. We keep only the NAME — custom
    // properties resolve to unevaluated calc() chains, and the value we
    // actually want is already in `styles` as the used value.
    const tokenValues = {};
    const definedTokens = [];
    for (const t of tokens) {
      const v = cs.getPropertyValue(t).trim();
      tokenValues[t] = v;
      if (v && v !== (parentTokenValues[t] ?? "")) definedTokens.push(t);
    }
    definedTokens.sort();

    const attrs = {};
    for (const a of el.attributes)
      if (KEEP_ATTR.test(a.name))
        attrs[a.name] = VOLATILE_ATTR.test(a.name) ? "<generated>" : stable(a.value);
    if (el.hasAttribute("href")) attrs.href = "<set>";
    if (el.hasAttribute("src")) attrs.src = "<set>";

    const rect = el.getBoundingClientRect();
    const isLeaf = el.children.length === 0;

    return {
      tag: el.tagName.toLowerCase(),
      classes: [...el.classList].sort(),
      attrs,
      text: isLeaf ? (el.textContent || "").trim().slice(0, 80) || null : null,
      styles,
      definedTokens,
      box: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      children:
        depth >= MAX_DEPTH
          ? []
          : [...el.children].map((c) => walk(c, tokenValues, depth + 1)),
    };
  };

  const base = {};
  const rootCs = getComputedStyle(document.documentElement);
  for (const t of tokens) base[t] = rootCs.getPropertyValue(t).trim();

  return {
    rootChildCount: candidates.length,
    tree: walk(componentRoot, base, 0),
  };
}
/* c8 ignore stop */

export async function observe({ storybookDir, jobs, viewport, onProgress }) {
  const { server, port } = await serve(storybookDir);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const results = {};

  try {
    for (const job of jobs) {
      const url = `http://127.0.0.1:${port}/iframe.html?id=${encodeURIComponent(
        job.storyId
      )}&viewMode=story`;
      try {
        await page.goto(url, { waitUntil: "load", timeout: 30000 });
        await page.waitForSelector("#storybook-root > *:not([hidden])", {
          state: "attached",
          timeout: 20000,
        });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        const observation = await page.evaluate(walkPage, {
          properties: OBSERVED_PROPERTIES,
          tokens: job.tokens,
        });
        results[job.storyId] = observation
          ? { ok: true, ...observation }
          : { ok: false, error: "empty #storybook-root" };
      } catch (error) {
        results[job.storyId] = { ok: false, error: String(error.message || error) };
      }
      onProgress?.(job.storyId, results[job.storyId].ok);
    }
  } finally {
    await browser.close();
    server.close();
  }
  return results;
}
