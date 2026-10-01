# design-sync notes — @kickstartds/design-system

Durable findings for future syncs. Everything here was paid for once; read it
before re-deriving. Run all design-sync commands from `packages/design-system`
(that dir is both the npm package root and the Storybook project root, so
`cwd`, `dirname(.storybook)` and the package dir all coincide — story
`importPath`s and `@ds-stories/...` previews resolve consistently only there).

## Repo shape

- `[GENERAL]` **The package ships no barrel.** `rollup.config.mjs` emits one
  chunk per `src/components/**/*Component.tsx`; `package.json` has no `"."`
  export, no `main`/`module`/`types`. `resolveDistEntry` therefore finds
  nothing and the converter's `.d.ts` export scan (`exportedNames` → entry
  `<pkg>/index.d.ts`) comes back empty.
  → Fix: `.design-sync/gen-entry.mjs` generates `.design-sync/ds-entry.mjs`,
  an explicit named-re-export barrel over `dist/components/*/index.js`
  (+ `Providers` default, + `IconSprite`). `cfg.entry` points at it.
  `.design-sync/ds-exports.mjs` (`export * from "./ds-entry.mjs"`) is listed in
  `cfg.extraEntries` *solely* so the build's source-scan of extraEntries
  populates the `exported` set — the set that gates the component roster and
  the relative-import redirect. Same module graph, so esbuild dedupes it; it
  does NOT bundle a second copy.
  **`ds-entry.mjs` is gitignored** (it is derived from gitignored `dist/`);
  `cfg.buildCmd` regenerates it, so never hand-edit it.

- `[GENERAL]` **Root `components.ts` is stale — do not trust it.** It is a
  gitignored playroom helper claiming e.g. `export {Checkbox} from
  "./src/components/checkbox/CheckboxComponent"`, but that module actually
  exports `CheckboxComponent`. `dist/components/*/index.js` is the authority.

- `[GENERAL]` **Form controls export `<Name>Component`.** `CheckboxComponent`,
  `CheckboxGroupComponent`, `RadioComponent`, `RadioGroupComponent`,
  `SelectFieldComponent`, `TextAreaComponent`, `TextFieldComponent`. Their
  story titles say `Form / Checkbox` → component name `Checkbox`. `gen-entry.mjs`
  exports **both** names (raw for story imports, clean alias for the card) via
  its `ALIASES` map. Add to that map if more such components appear.

- `[GENERAL]` **`dist/`, `src/contract-defaults/`, `components.ts`,
  `snippets.json` and all `*.dereffed.json` / `*-tokens.json` are gitignored
  generated artifacts.** A fresh clone has none of them; `pnpm run build` plus
  the storybook prerequisites must run before any sync.

## Build gotchas

- `[GENERAL]` **`@glidejs/glide` breaks the esbuild bundle.**
  `@kickstartds/content`'s prebuilt ESM imports `@glidejs/glide/src/index` and
  ~20 siblings *without* `.js`; glide's exports map is a literal
  `"./src/*": "./src/*"`, so esbuild reports 20× `[UNRESOLVED_IMPORT]`
  (Vite resolves it, which is why the repo's own Storybook builds fine).
  → Fix: `.design-sync/tsconfig.ds-sync.json` maps `@glidejs/glide/src/*` at
  the repo-root symlink `node_modules/@glidejs/glide`, wired via
  `cfg.tsconfig`; the converter's paths plugin probes extensions and appends
  `.js`. Reaches the main bundle *and* `preview-rebuild.mjs`.
  Pulled in by slider / testimonials / gallery — not droppable.
  **Do not put a `"//"` comment key in that tsconfig.** `tsconfigPathsPlugin`
  strips `//` comments with a regex that also eats a `"//"` JSON key, the
  resulting parse error is swallowed (`catch { return null }`), and the plugin
  silently never fires — the glide errors come back with no explanation. Cost
  one rebuild cycle to find.

- `pnpm run build` is slow and destructive: it starts with `rm -rf dist`, runs
  a `vitest`-driven presets step, shells out to the `kickstartDS` CLI, reaches
  a workspace sibling (`../token-graph`), and ends by copying a **47 MB**
  `snippets.json`. `dist/` ends up ~169 MB. Don't run it casually — if `dist/`
  is current, bundle it as-is.

- The reference Storybook builds in ~20 s with plain
  `npx storybook build -c .storybook -o "$PWD/.design-sync/sb-reference"`, but
  only because the generated inputs (`src/token/tokens.css`,
  `src/token/IconSprite.js`, `*.dereffed.json`, `*-tokens.json`,
  `static/tokens/`, `static/pagefind/`) are already on disk. On a fresh clone
  run `pnpm run build-tokens && pnpm run schema && pnpm run token &&
  pnpm run search && pnpm run copy-theme-css` first.

- `[GENERAL]` **The preview-decorator bundle needs a forked loader map.**
  `bundlePreviewDecorators` hardcodes `loader: {'.js','.json'}`. Here
  `.storybook/preview.tsx` → `PageWrapper` → `Providers` → every component →
  `button.scss`, so it died with `No loader is configured for ".scss"` and
  previews silently lost the decorator chain. Losing it is NOT cosmetic here:
  the first decorator is `unpackDecorator` and the args are `pack()`ed, so
  every component would have rendered with flattened props.
  → Fix: `.design-sync/overrides/source-storybook.mjs` (declared in
  `cfg.libOverrides`) — a 4-line fork: 3 sibling imports repointed at
  `../../.ds-sync/lib/`, and the decorator build's loader map widened to
  `STORY_LOADERS`. Keep it minimal; re-apply on top of a fresh bundled copy if
  the skill updates that module.
  Needs `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` (the fork
  dynamically imports `esbuild`). That symlink is gitignored — **recreate it
  once per clone**.

- `[GENERAL]` **Stories import `./<Name>Component`, so the import redirect
  misses without aliases — the highest-impact silent failure here.**
  `story-imports.mjs` rule 2 decides "is this import a shipped component?" by
  testing the resolved file/dir name against the bundle's export list. Stories
  say `import { Button } from "./ButtonComponent"`; the bundle exports
  `Button`; no match → the preview bundles a **second copy from source**, with
  `.scss` compiled to empty (unstyled) and its own React context identity (the
  Providers chain no longer reaches it). Nothing errors — previews just look
  subtly wrong.
  → Fix: `gen-entry.mjs` exports a `<Name>Component` alias for every
  component (`Button as ButtonComponent`). The card roster is story-title
  driven, so aliases never produce extra components. Verified coverage: the
  only `src/**/*Component.tsx` files left unshimmable are the 19 token-demo /
  playground / pages modules, all excluded via `cfg.titleMap`.

- `[FONT_MISSING]` here is a **false positive — do not chase it.** The flagged
  names ("Avenir Next", Baskerville, "Hoefler Text", …) are all *fallbacks*
  inside `--ks-brand-font-family-*` stacks whose FIRST family is Montserrat,
  and Montserrat's 5 woff2 + `@font-face` do ship to `fonts/`. Nothing is
  rendering in a substitute font.

- `[TOKENS_MISSING]` (~46) is likewise mostly expected: `--dsa-*` / `--c-*`
  component vars that components set inline at runtime. `ds-bundle/tokens/` is
  empty because no `cfg.tokensPkg`/`tokensGlob` is set, but that is not a
  functional gap — all 1520 `--ks-*` definitions ship inside `_ds_bundle.css`,
  which `styles.css` `@import`s, so rendered designs do get the tokens.

- `[GENERAL]` **`compare.mjs` reports 100% `sb-error` on this DS until the
  staged copy is patched — run `node .design-sync/patch-staged.mjs`.**
  The harness probes "did the story render?" with
  `waitForSelector(':is(#storybook-root,#root) > :not(style,script,link,meta,template)')`,
  which defaults to `state:'visible'` and locks onto the FIRST match. Here
  `PageWrapper` renders `<IconSprite />` — a `<svg hidden height=0 width=0>` —
  as the first root child, so the wait always times out and every story is
  falsely reported `sb-error: no storybook root content` (the reference
  storybook renders fine; verified the selector matches `[hidden svg, BUTTON]`
  and `state:'attached'` resolves instantly). The patch adds `[hidden]` to the
  exclusion list.
  **`.ds-sync/` is gitignored and re-copied from the skill on every sync, so
  the patch must be re-applied after each `cp -r`.** `patch-staged.mjs` is
  idempotent and asserts on the exact upstream text, so a skill update that
  moves the line fails loudly instead of silently reverting.

- `[GENERAL]` **`pack()`ed args never reached `unpack()` in previews — the
  subtlest and most damaging issue found.** `@kickstartds/core`'s `pack()`
  dot-flattens nested props (`image: {srcMobile}` → `"image.srcMobile"`, arrays
  → `"buttons.0.label"` + `"buttons__count"`), and `.storybook/preview.tsx`
  un-flattens them with the preview-level `unpackDecorator`, which is
  implemented as `(Story, ctx) => Story({...ctx, args: unpack(ctx.args)})` —
  i.e. it depends on Storybook's contract that `Story(ctx)` re-renders with
  the ctx you hand it. The preview host does NOT honour that contract: the
  generated wrapper bakes the packed args into the element first, then
  `__dsDecorate` passes decorators a `Story` thunk that ignores its ctx (and a
  ctx whose `args` is `{}`). So `unpackDecorator` ran as a pure no-op and every
  component received literal `"image.srcMobile"` props.
  Symptom: flat-arg components (Button, Text) looked perfect, while every
  nested-arg component silently lost its headline, buttons and array children —
  and some threw `The 'style' prop expects a mapping… not a string`, which in
  React 19 **kills the subtree** (that is why Hero/Section rendered body copy
  but no headline). Easy to misread as a provider or CSS problem; it is neither.
  → Fix: `.design-sync/overrides/preview-gen-storybook.mjs` calls
  `unpack()` on the merged args at the same point in the chain Storybook does
  (outside every meta/story decorator, before the element is created).
  **If previews ever regress to "renders but missing nested content", check
  this fork first.**

- `[GENERAL]` **The decorator bundle must share React context identity with
  `_ds_bundle.js`.** `bundlePreviewDecorators`' `dsShim` only redirects imports
  of the package NAME (or exactly `<pkg>/src`). This repo's
  `.storybook/preview.tsx` pulls its provider chain in by relative SOURCE path
  (`../src/components/page-wrapper/PageWrapperComponent`,
  `../src/components/Providers`), so those bundled from source and the
  decorator bundle got its **own copies of every kickstartDS context**. The
  `Providers` overrides then never reached the components inside
  `_ds_bundle.js`, which fell back to the upstream BASE kickstartDS
  components — different prop contracts, so `style="h1"` leaked onto a DOM
  `<header>` and React 19 killed the subtree.
  Symptom: Section rendered a generic 2-card stack with no headline whatever
  its `layout` prop said; Hero rendered body copy but no headline/buttons;
  `✗ root empty` on Section/BlogOverview/SearchModal.
  → Fix: the `source-storybook.mjs` fork also redirects any relative import
  resolving under `<pkg>/src/components/` to `window.KickstartDS`. This
  requires `Providers` AND `providerDecorator` to be bundle exports
  (`gen-entry.mjs` handles both).
  Effect: full render check went 64/73 → **71/73 clean**, and every
  `style`-prop crash disappeared.

- `[GENERAL]` **Story images do not reach previews — known, not fixable in
  scope. Do NOT spend fix iterations on it.** Stories reference repo static
  assets by PAGE-RELATIVE path (`image: "img/people-....png"`, 44 distinct
  refs, all of which exist). Storybook serves them via `staticDirs: ["../static"]`
  (315 files land in `sb-reference/img/`); the preview host serves `ds-bundle/`,
  which has no `img/`, and the upload layout has no slot for one — a project-root
  `img/` is outside the app's contract, and `img/...` resolved from
  `components/<group>/<Name>/<Name>.html` would not reach it anyway. Fixing it
  would require forking `emit.mjs`, which is app-contract surface.
  Affects 29 of the 30 image-referencing story files.
  → Grade such stories `close` with a note naming the missing asset. The
  COMPONENTS are unaffected: a design agent that passes real image URLs gets
  correct rendering, which is why this is a card-fidelity limit, not a
  component-fidelity one. Mentioned in `conventions.md` so the design agent
  always supplies its own image URLs.

- `[GENERAL]` The preview page's content container is **narrower** than the
  storybook canvas at the same 900px capture width, and the preview panel
  captures at a fixed 700px height while the storybook panel captures at
  content height. Width-responsive components (multi-column text, card lists)
  therefore legitimately show a different column count or a clipped last row.
  Verified non-substantive: computed font-size/line-height/column-width are
  byte-identical on both sides. Grade `close`, don't chase.

- `[GENERAL]` **The capture server served `.svg` as `application/octet-stream`,
  so SVG story assets were broken on the ORACLE panel too.** Found independently
  by two fan-out batches. `.ds-sync/storybook/http-serve.mjs`'s MIME map covered
  only `.html/.js/.mjs/.css/.json/.png`; Chromium deliberately does not
  MIME-sniff SVG, so every `<img src="*.svg">` rendered as alt text on BOTH
  panels even though `.design-sync/sb-reference/img/` ships the files. Raster
  formats sniff, which is why `.png` worked and masked it. Proof: the same
  `logo.svg` has `naturalWidth: 0` through the harness and `121` with
  `image/svg+xml` added.
  This is the `[ASSETS_BLOCKED]` false-pass class — symmetric degradation that
  makes sheets look identical while proving nothing.
  → Fix: `patch-staged.mjs` adds `.svg`, `.jpg/.jpeg`, `.gif`, `.webp`, `.avif`,
  `.ico`, `.woff2/.woff`. Worth reporting upstream — it is the skill's own
  static server, not repo-specific.

- `[GENERAL]` **`cfg.cssEntry` was APPENDED after the module-graph CSS, which
  inverts storybook's cascade and really did change rendering.**
  `package-build.mjs` appends `dist/global.css`, so `_ds_bundle.css` ordered
  component CSS (~byte 130k) then global.css (~byte 1.22M). Vite/storybook emit
  the opposite order (component chunk CSS last). `src/global.scss` carries
  dev/demo rules that collide with component rules at IDENTICAL specificity —
  notably `hr.c-divider { --c-divider--background: var(--ks-border-color-accent) }`
  — so global won and Divider rendered light blue `rgb(224,232,246)` instead of
  grey `rgb(218,218,222)`. Identical DOM and classes on both panels; only that
  one custom property differed.
  → Fix: `patch-staged.mjs` makes the cssEntry PREPEND instead. Fonts are
  unaffected (still a plain concatenation, so `extractFonts` /
  `rewriteBundleFontFaces` see the same `@font-face` url()s).
  Any future equal-specificity collision between `global.scss` and a component
  stylesheet will surface the same way — check CSS order first.

- `[RENDER_THIN] variants render identically` on the form controls is a
  **false positive**. Checkbox/Radio/TextArea/TextField each have exactly two
  stories; the authored `Default` is literally `args: pack({})` and takes all
  props from `...getArgsShared(schema)`, and the generated contract-default
  derives from the SAME schema, so both emit the same label. The two
  *storybook* reference PNGs are byte-identical. Not a lost variant. Same for
  `SplitEven`/`SplitWeighted`/`Header` contract-defaults, which are genuinely
  blank slots in storybook too (900x27, 0% ink).

- Image-bearing stories are only `close` when the STORYBOOK side actually has
  the asset. Several contract-default stories point at paths storybook can't
  resolve either (and `Gallery`'s contract-default uses literal
  `https://example.com/image1.jpg`), so both panels show the same broken
  placeholder — those are a genuine `match`. Do not blanket-downgrade every
  image-bearing story. Note also that compare's `[ASSETS_BLOCKED] … example.com`
  warning comes from that fixture, not from sandboxed egress.

- `[GENERAL]` **Animated / count-up numerals never match exactly.** `Stats`
  (and any future counter / progress / odometer) animates its value with a
  rAF-driven count-up toward the story's target. The harness's frozen clock and
  reduced-motion settings pin CSS animations but NOT a rAF counter, so the two
  panels are photographed a few frames apart (117K/77%/39h vs 110K/73%/37h).
  No prop pins the displayed value, so an owned preview can't fix it. Grade
  `close`; composition, icons, labels and typography are equivalent.

- `[GENERAL]` **A missing image is not always cosmetic — it can collapse
  layout.** `Hero / TextOnImageWithOverlay` sets `height: "fullImage"`, so the
  hero sizes to the image's intrinsic height; with the asset absent it
  collapses to a ~25px strip and the headline/body/button scroll out of the
  700px capture. Still `close` under the standing image rule, but a reviewer
  skimming the sheet could easily misread it as a broken component.

- When a component's entire render is one colour or a hairline (Divider), the
  shrunk sheet cannot distinguish `rgb(218,218,222)` from `rgb(224,232,246)` —
  open the raw PNG and sample the pixel. That is how the CSS-cascade fix above
  was confirmed.

- Framing offset measured precisely: a consistent ~24px right/down offset plus
  a narrower content container. On fixed-height full-width controls it changes
  only rendered width, never type/border/radius/shadow/spacing — those are
  `match`, not `close`.

- The `[RENDER_THIN]` form-control false positive also covers **SelectField**
  (validate doesn't flag it, but its two stories are byte-identical on both
  panels, same as Checkbox/Radio/TextArea/TextField). Verified mechanically by
  comparing raw PNG checksums rather than by eye — the reliable way to settle
  "variants render identically".

- `[GENERAL]` **The missing-story-asset class is wider than `<img src="img/...">`.**
  It also covers: `<video>` sources (VideoCurtain's three clips
  `img/videos/video-720.mp4`, `video-agency.mp4`, `handshake-bw.mp4` — the
  preview shows the bare overlay gradient, which reads like a codec problem but
  isn't), and ROOT-relative refs (`/logo.svg`, `/logo-inverted.svg` in Header
  and Footer). Header's logo is NOT greppable in `Header.stories.tsx` — it comes
  via `dsa.logo` in `src/themes/index.ts`.

- `[GENERAL]` **A missing asset can reflow text, not just leave a hole.** When
  the absent image is the sized element of a split/media-object layout
  (ImageStory, SplitEven/SplitWeighted tiles, BlogTeaser), its column collapses
  and the text column widens, so line breaks and content height differ too.
  Grade the TEXT on content/type/colour, not on line-for-line alignment.

- `[GENERAL]` **Absolutely-positioned overlays land at different vertical
  offsets on the two panels.** NavDropdown's `position:absolute; top:100%`
  resolves against the tall storybook canvas (panel pushed to the bottom edge)
  vs the shorter preview container (panel at the top). Same container-geometry
  root cause as the width reflow, surfacing vertically. No fix — never add a
  wrapper the story doesn't have, that fakes the fidelity being verified.

- `[GENERAL]` **A fully-skipped component keeps a STALE
  `.design-sync/.cache/compare/<Name>.json`.** compare drops it from the run and
  never rewrites or removes the file, so it still lists the skipped story with
  an old `outBaseSha`. When auditing "does this component still have stories?",
  trust `ds-bundle/.compare-report.json` or `sb-reference/index.json` +
  `cfg.overrides`, never the per-component cache JSON alone.

- **Grading method that repeatedly beat eyeballing** (worth reusing):
  - "variants render identically" → `md5sum` the two raw PNGs per panel. If both
    `__sb.png` share one checksum and both `__ds.png` share another, the stories
    are identical BY FIXTURE on both sides — a genuine `match`, settled in one
    command. Confirmed this way for Checkbox/Radio/SelectField/TextArea/
    TextField and SearchForm.
  - A blank-looking contract-default → read the storybook canvas HEIGHT first.
    ~27px with no ink means the reference is blank too (`match`); a tall sb
    canvas against a blank preview is a one-sided loss (not a match).
  - A component whose whole render is one colour or a hairline → open the raw
    and sample the pixel; the shrunk sheet cannot tell `rgb(218,218,222)` from
    `rgb(224,232,246)`.

- Four components ship as **floor cards** (bundle + `.d.ts` + `.prompt.md`, no
  preview) because their ONLY story was the unrenderable generated
  contract-default: **ButtonGroup, NavFlyout, NavMain, NavTopbar**. They remain
  fully usable by the design agent; they just have no preview image. Giving them
  previews requires real stories in the DS, not a design-sync change.

## Storybook specifics

- Storybook **10.2.0-beta**, `@storybook/react-vite`, React **19.2.1**. CSF3
  throughout; no `play:`, no `loaders:`, no MSW, no `composeStories`.
- **Args are `pack()`ed.** Nearly every component story spreads
  `...getArgsShared(schema)` and wraps args in `pack()` from
  `@kickstartds/core/lib/storybook`. `.storybook/preview.tsx`'s first decorator
  is `unpackDecorator`, which un-flattens them. **Any preview path that loses
  that decorator renders every component with flattened, wrong props** — this
  is the single highest-risk global failure for this repo.
- The second preview decorator wraps stories in `<PageWrapper>` =
  `<Providers><IconSprite />{children}</Providers>`, and `PageWrapper`
  side-effect-imports `src/global.client` — **that is where global CSS enters
  Storybook**, not `preview.css`.
- `.storybook/preview.tsx` and `ThemeTool.tsx` fetch CMS themes from
  `api.storyblok.com` and Google Fonts at module scope. Both no-op without
  `STORYBLOK_API_TOKEN`; stories don't depend on them (default theme = no
  overrides).
- Two components use React portals: `search-modal` and `cookie-consent`.
- `src/contract-defaults/*.stories.tsx` (68 files, generated, gitignored) add a
  `Contract Defaults/<Name>` title for 57 components that already have richer
  `Components/…` stories; both titles map to the same component name, so they
  MERGE into one card's story list rather than duplicating cards.

## Re-sync risks

- `.design-sync/ds-entry.mjs` is generated from `dist/`. If a component is
  added or removed and `gen-entry.mjs` isn't re-run, it silently disappears
  from `window.KickstartDS` and from the roster. `cfg.buildCmd` runs it.
- The `@glidejs/glide` tsconfig mapping hardcodes `../../../node_modules/@glidejs/glide/src/*`
  (the pnpm root symlink). A pnpm layout change or glide fixing its exports map
  would make it dead config, not an error — re-check if `[UNRESOLVED_IMPORT]`
  reappears.
- `src/contract-defaults/` is generated and gitignored, so the story set (and
  therefore graded story lists) differs between a fresh clone and this working
  tree unless the contracts generator is re-run.

- **`.ds-sync/` is gitignored and re-copied from the skill on every sync, and
  THREE of this repo's fixes live there as patches, not forks.** After each
  `cp -r <skill>/… .ds-sync/` you MUST run `node .design-sync/patch-staged.mjs`
  or verification silently degrades: compare reports 100% `sb-error`, SVG
  assets go dark on the oracle panel, and `global.css` re-inverts the cascade.
  The script asserts on exact upstream text, so a skill update that moves any
  of those lines fails loudly — re-derive the patch against the new source
  rather than forcing it.
  Also recreate `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules`
  once per clone (the `source-storybook.mjs` fork imports `esbuild`).

- **The three `cfg.libOverrides` forks are pinned to the skill version synced
  2026-10-01.** If the skill updates `source-storybook.mjs`,
  `story-imports.mjs` or `preview-gen-storybook.mjs`, re-apply the documented
  minimal edit on top of a FRESH bundled copy rather than keeping the old fork
  — each fork is 1–4 lines and the reason is recorded in `cfg.libOverrides`.

- **`cfg.provider` is deliberately NOT set.** The preview wrapper comes from the
  bundled `.storybook/preview` decorators. Setting `provider` would make the
  generated README/prompt.md emit concrete wrap guidance (currently a generic
  note), but it is part of the grade contract, so it would clear and re-verify
  all 73 components. The wrap guidance lives in `conventions.md` instead, which
  is prepended to the README and read first. **If a future sync wants
  `cfg.provider: {"component": "PageWrapper"}`, set it at the START of the run**,
  before any grading, not after.

- Verified-state lives in the uploaded `_ds_sync.json`, not in git.
  `.design-sync/.cache/` is gitignored, so a fresh clone re-verifies from the
  anchor, not from local grade files.

- Accepted `close` verdicts (82 of 187 stories) are almost entirely two classes:
  missing story assets and preview-page framing. If a future run sees those
  numbers drop sharply, something changed for the better (assets reachable);
  if `close` turns into `mismatch` anywhere, check the three forks first.

## Skipped stories (and why)

- `cfg.overrides.CookieConsent.skip` — `contract-defaults-cookieconsent--contract-default`,
  `corporate-cookie-consent--card`, `corporate-cookie-consent--banner`. All three
  render nothing inside `#storybook-root` in the repo's OWN storybook: the
  consent dialog is `createPortal`ed to `document.body` and only appears after a
  `window._ks.radio` event. There is no reference render to grade against.
  `C15t` is kept and is the `primaryStory` — it renders the real banner
  (Customize / Reject All / Accept All) in the preview while the storybook
  panel shows only the "reset" trigger, i.e. the preview renders MORE than the
  gated reference.
- `cfg.overrides.SearchModal.skip` — `contract-defaults-searchmodal--contract-default`
  (no storybook root content). `Pagefind` is kept and matches: both panels show
  just the "Open" trigger plus a rule, because the modal is closed by default.
  Its page-level `Error: please connect a search engine` is pagefind failing to
  load `/pagefind/pagefind.js`, which storybook serves from `static/pagefind`
  and the preview host does not. Non-fatal and invisible in the render.

- Eight further `cfg.overrides.<Name>.skip` entries, all the same cause: the
  GENERATED `contract-defaults-<name>--contract-default` story renders nothing
  inside `#storybook-root` in the repo's own storybook, so there is no
  reference render to grade against. Affected: Breadcrumb, ButtonGroup,
  Downloads, EventHeader, ImageStory, NavFlyout, NavMain, NavTopbar. These are
  sub-components whose contract-default args carry no content; the real
  `Components/…` or `Corporate/…` stories for them are graded normally.
