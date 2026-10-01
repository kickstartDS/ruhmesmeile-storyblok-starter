// Patches the STAGED converter scripts in .ds-sync/ (gitignored, re-copied
// from the skill on every sync — so this must be re-run after each `cp -r`).
//
//   node .design-sync/patch-staged.mjs
//
// Idempotent, and asserts on the exact upstream text: if a skill update moves
// the line, this fails loudly instead of silently not applying.
//
// ── Why the one patch below exists ──────────────────────────────────────────
// compare.mjs decides "did the storybook story render?" with
//   waitForSelector(':is(#storybook-root,#root) > :not(style,script,link,meta,template)')
// which defaults to state:'visible' and locks onto the FIRST matching element.
// This DS's `.storybook/preview.tsx` wraps every story in `<PageWrapper>` =
// `<Providers><IconSprite />{children}</Providers>`, and `IconSprite` is a
// `<svg hidden height="0" width="0">` — i.e. the first root child is
// permanently invisible. The wait therefore ALWAYS times out and every single
// story is reported `sb-error: no storybook root content`, even though the
// reference storybook renders perfectly (verified: the selector matches
// [hidden svg, the real BUTTON], state:'attached' resolves immediately).
//
// Adding `[hidden]` to the exclusion list makes the probe skip invisible
// elements and lock onto the real story content. This does not weaken the
// oracle: grading still comes from the true screenshots of both panels; it
// only stops a false negative that otherwise makes this DS ungradeable.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

// ── Patch 2: the capture server's MIME map has no .svg ──────────────────────
// http-serve.mjs serves BOTH panels (sb-reference and ds-bundle) and maps only
// .html/.js/.mjs/.css/.json/.png, falling back to application/octet-stream.
// Chromium deliberately does NOT MIME-sniff SVG, so every `<img src="*.svg">`
// renders as alt text on BOTH panels — an [ASSETS_BLOCKED]-class false pass:
// the sheets look symmetric and prove nothing, even though
// .design-sync/sb-reference/img/ actually ships those files. Raster formats
// sniff, which is why .png worked and masked the bug.
// Adding the real image/font types makes the reference panel honest. It
// surfaces MORE deltas, not fewer — which is the point.
const PATCHES = [
  {
    file: ".ds-sync/storybook/compare.mjs",
    from: "const SB_CONTENT = `:is(${SB_ROOT}) > :not(style,script,link,meta,template)`;",
    to: "const SB_CONTENT = `:is(${SB_ROOT}) > :not(style,script,link,meta,template,[hidden])`;",
  },
  // ── Patch 3: cfg.cssEntry must be PREPENDED, not appended ────────────────
  // package-build.mjs appends dist/global.css after the CSS esbuild collected
  // from the JS module graph, so in _ds_bundle.css the order is
  //   component CSS (~byte 130k)  ->  global.css (~byte 1.22M)
  // Storybook/Vite emit the opposite order (component chunk CSS last). This
  // DS's src/global.scss carries dev/demo rules that collide with real
  // component rules at IDENTICAL specificity, e.g.
  //   hr.c-divider { --c-divider--background: var(--ks-border-color-accent) }
  // so with global last the global rule wins and Divider renders light blue
  // rgb(224,232,246) instead of grey rgb(218,218,222). Verified by computed
  // style on both panels: identical DOM, identical classes, only
  // --c-divider--background differs.
  // Prepending restores storybook's cascade. Fonts are unaffected: the
  // cssEntry file is still a plain concatenation, so extractFonts /
  // rewriteBundleFontFaces still see the same @font-face url()s.
  {
    file: ".ds-sync/package-build.mjs",
    from: "  appendFileSync(bundleCss, `\\n/* appended from cfg.cssEntry */\\n${readFileSync(explicitCss, 'utf8')}`);",
    to:
      "  writeFileSync(bundleCss, `/* prepended from cfg.cssEntry (patch-staged.mjs: storybook/Vite order) */\\n`\n" +
      "    + readFileSync(explicitCss, 'utf8') + `\\n/* --- esbuild module-graph CSS --- */\\n` + readFileSync(bundleCss, 'utf8'));",
  },
  {
    file: ".ds-sync/storybook/http-serve.mjs",
    from: "'.json': 'application/json', '.png': 'image/png' };",
    to:
      "'.json': 'application/json', '.png': 'image/png', " +
      "'.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', " +
      "'.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', " +
      "'.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };",
  },
];

let applied = 0;
let already = 0;
for (const p of PATCHES) {
  if (!existsSync(p.file)) {
    console.error(`! ${p.file} missing — stage the scripts first (cp -r <skill>/… .ds-sync/)`);
    process.exit(1);
  }
  const src = readFileSync(p.file, "utf8");
  if (src.includes(p.to)) { already++; continue; }
  if (!src.includes(p.from)) {
    console.error(`! ${p.file}: expected text not found — the skill changed upstream.`);
    console.error(`  looked for: ${p.from}`);
    console.error("  Re-derive the patch against the new source before trusting any compare run.");
    process.exit(1);
  }
  writeFileSync(p.file, src.replace(p.from, p.to));
  applied++;
}
console.error(`patch-staged: ${applied} applied, ${already} already present`);
