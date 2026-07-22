# Optoma → Template Upstreaming Checklist

Tracks progress for porting generic improvements from the `optoma-website` fork into this template.
See [optoma-upstreaming-inventory.md](../plans/optoma-upstreaming-inventory.md) for the full
categorized inventory and [adr-optoma-upstreaming.md](../../adr/adr-optoma-upstreaming.md) for
architectural/process decisions.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` skipped (with reason)

---

## Batch A — Build & token tooling

Branch: `upstream/batch-a-token-tooling`

> Investigation done (see ADR-004..006). Batch A is now **self-contained**; the `token-graph`
> build step + `@kickstartds/token-graph` dep + `token-graph.json` copy move to **Batch B**.

- [x] A.0 Create branch off clean `main`
- [x] A.1 Investigate diffs for each Batch A file (generic vs brand-tainted)
- [x] A.2 Port `scripts/tokensToCss.mjs` fontFamily quoting fix
- [x] A.3 Port `scripts/componentTokensToCss.mjs` + `componentTokensToCss.d.mts`
- [x] A.4 Port `scripts/tokensToCss.d.mts` + `src/scss.d.ts`
- [x] A.5 Port `scripts/extractComponentTokenCatalog.cjs`
- [x] A.6 Port `scripts/extractSemanticTokenCatalog.cjs`
- [x] A.7 Add `package.json` scripts: `component-token-catalog`, `semantic-token-catalog` + build wiring
- [x] A.8 Add `rollup.config.mjs` copy entries (catalog JSONs + tooling; **not** `token-graph.json`)
- [x] A.9 Regenerate `component-token-catalog.json` + `semantic-token-catalog.json` in-template (ADR-005)
- [x] A.10 Build design-system; confirm catalogs generate + build stays green
- [x] A.11 Add changeset
- [x] A.12 Committed (`bd6f437e`), pushed, PR [#6](https://github.com/kickstartDS/ruhmesmeile-storyblok-starter/pull/6) opened
- [-] A.x `.storybook` font/favicon swap — **excluded** (brand, ADR-006)
- [x] A.y `token-graph` build wiring + workspace dep + `token-graph.json` copy — **done in Batch B**

## Batch B — Cosmos Token Graph (new package)

Branch: `upstream/batch-b-token-graph` (stacked on `upstream/batch-a-token-tooling`, ADR-007)

- [x] B.0 Create branch (off Batch A branch — stacked PR, A not yet merged)
- [x] B.1 Port `packages/token-graph/**` (18 files, verified brand-neutral)
- [x] B.2 Port ADR/PRD/checklist docs (cosmos-token-graph)
- [x] B.3 Wire workspace dep + `token-graph` build step + rollup copy; `pnpm install`; DS build green (token-graph.json: 1708 nodes / 1988 edges — matches optoma exactly); package typecheck green
- [x] B.4 Changeset + PR

## Batch C — Component Token Editor

- [x] C.0 Create branch — `upstream/batch-c-component-token-editor` (off main after A+B merged)
- [x] C.1 Port `design-tokens-editor/src/{component-editor,graph,preview-page}/**` — 7 new files (5 component-editor, GraphView, ComponentPreviewPage)
- [x] C.2 Review remaining `design-tokens-editor` (15 mod) + `design-tokens-mcp` (3 mod) diffs — `get_theme_schema`/`validate_theme` gain `componentTokens` catalog validation; `sync-tokens.mjs` adds component + semantic catalogs; `vite.config.ts` alias to `token-graph.json`
- [x] C.3 Port ADR/PRD/checklist docs — `adr-component-token-editor.md`, `component-token-editor-prd.md`, `component-token-editor-checklist.md`
- [x] C.4 Build + validate — editor build ✓ (18.12s), editor typecheck ✓, design-tokens-mcp build ✓. Excluded `design-tokens-mcp/tokens/branding-tokens.css` (optoma brand values) — regenerated via `sync-tokens` to template `#3065c0`; catalogs gitignored (generated). Sanitised 3 optoma sample TeaserCards in `ComponentPreviewPage.tsx` → brand-neutral DS Agency content
- [~] C.5 Changeset + PR — changeset added (`@kickstartds/design-tokens-mcp` minor); PR pending

## Batch D — Design-system component fixes

- [x] D.0 Create branch
- [x] D.1 Port component `*.tsx` / `*.scss` / `*.schema.json` (strip brand token values) — 37 brand-neutral files; excluded 44 brand-laden stories + Footer redesign (ADR-008); folded in 2 brand-neutral story carve-outs (gallery `SliderGallery`, business-card `contact`→`contactLinks`; see R.12)
- [-] D.2 Regenerate LFS snapshots + screenshots locally — deferred to canonical CI; local regen = env drift, 141/157 incl. untouched leaves (ADR-009)
- [x] D.3 Build + Storybook a11y check — `build` green (presets 136 passed); `build-storybook` green (search index)
- [x] D.4 Changeset + PR

## Batch E — Dependency & patch updates

- [x] E.0 Create branch
- [x] E.1 Port `patches/unpic@3.22.0.patch` (Storyblok filter-parser fix)
- [x] E.2 Port `patches/kickstartds@3.5.0--canary.62.324.0.patch` (storyblok-task rc-config fix)
- [x] E.2b Extend `patches/@kickstartds__jsonschema-utils@3.9.0.patch` (preserve title/description/required in `reduceSchemaAllOfs`)
- [x] E.3 Update `package.json` `patchedDependencies` (+2 entries)
- [x] E.4 `pnpm install` to regenerate lockfile (patch hashes registered; versions resolve in lockfile)
- [x] E.5 Changeset + PR — patch bump `@kickstartds/design-system` (pnpm patches are local-only; ADR-010). DS build green (presets 137)

## Batch F — Generic plugins/tooling

- [x] F.0 Create branch
- [x] F.1 `storyblok-icon-sprite-picker-field-plugin/**` — already on `main` (App.tsx `allowedIcons` filter + dist ported in an earlier batch; `main` == `optoma` for this plugin, no delta)
- [x] F.2 Review + port `storyblok-mcp` / `storyblok-services` hunks — 5 files: per-component token overrides for theme create/update (config.ts, register-tools.ts, services.ts, index.ts, themes.ts). `transform.ts` numeric-`component` fix already on `main`. All brand-neutral.
- [x] F.3 Changeset + PR — minor bump `@kickstartds/storyblok-services` + `@kickstartds/storyblok-mcp-server`. Both packages build green; no generated churn.

## REVIEW backlog — dispositions decided 2026-07-22 (ADR-011)

- [ ] R.1 SharePoint folder-picker plugin + helpers/api → **PORT** → **Batch K** (template will ship the SharePoint integration)
- [x] R.2 Datasheet PDF generation → ⛔ **EXCLUDED** — Optoma-specific (product datasheet PDFs)
- [x] R.3 spec-group / download-category / downloads → ⛔ **EXCLUDED** — Optoma-specific (product spec/download tables)
- [x] R.4 book-a-demo → **PORTED in Batch I** — 3 self-contained files (`BookADemoComponent.tsx` + 2 SCSS) + `index.scss` `@use`. No story/schema (website component, not a Storyblok blok / no Storybook); default label `"Book a Demo"` already generic → nothing to de-brand. Functional render wiring (`_app.tsx` `<BookADemo>`, settings/page props) is settings-driven → **deferred to Batch L**
- [ ] R.5 settings / token-theme / infra contexts → **PORT** → **Batch L** _(re-scoped from G, 2026-07-22 — functional wiring lives in the `_app.tsx`/`ComponentProviders.tsx` refactor; ports whole with R.8)_
- [x] R.6 `cms/language` i18n system → **already on `main`** (present since the mono-repo move, predates the fork; optoma *deleted* it) — **nothing to port**
- [x] R.7 `cms/visibility` system → `cms/visibility/**` output **already on `main`**; only the generator **script** `generateVisibilityFromPatterns.ts` is new on optoma → **PORTED in Batch H** with `--layer` default de-branded `"optoma"` → `visibility`
- [ ] R.8 website component root diffs (header/footer/Page/section/timeline/prompter) → 🔍 **CLOSER LOOK** — 10 files, 0 brand-keyword hits but needs a manual read to disentangle. Working assumption: new website-level `footer/FooterComponent.tsx` + `footer.scss` fold into **Batch J** (paired with R.11); `header/nav-header-cta.scss`, `section/*`, `timeline/TimelineProps.ts`, `prompter/*` prop+schema tweaks reviewed individually before promotion
- [x] R.9 **SPLIT**: `.vscode/settings.json` (inotify/watcher/search excludes — generic) + `docs/internal/plans/hero-slider-workflow-improvements.md` (generic MCP/tooling feedback, no brand content — despite the title) → **PORTED in Batch G**; `helpers/ingest-template.ts` → ⛔ **EXCLUDED** (Optoma-specific content ingest helper)
- [x] R.10 Storybook `a11y: { test: "off" }` toggle (`.storybook/preview.tsx`, 3-line addition) → **PORTED in Batch G**
- [ ] R.11 Design-system **Footer redesign** (schema `navItems` → multi-column `navGroups`, byline removal) + brand-neutral story rewrite → **PORT** → **Batch J** — deferred from Batch D (ADR-008); must port component **and** a de-branded story together (story-coupled, breaks search-index otherwise)
- [x] R.12 **Generic story carve-outs missed by wholesale story exclusion** (Batch D analysis) — **folded into Batch D**: (a) gallery `SliderGallery` variant added (brand-neutral placeholder images) so the ported `slider` layout (`Gallery.client.js` + slider tokens) has Storybook coverage; (b) business-card template story `contact:` → `contactLinks:` (fixed latent template bug — story set a non-existent `contact` prop, so the demo rendered without contact links).

---

## Batch G — Editor / infra config

- [x] G.0 Create branch
- [x] G.1 Port `.storybook/preview.tsx` `a11y: { test: "off" }` toggle (R.10)
- [x] G.2 Port `.vscode/settings.json` watcher/search excludes (R.9 partial)
- [x] G.3 Port `docs/internal/plans/hero-slider-workflow-improvements.md` (generic MCP/tooling feedback; marked historical) (R.9 partial)
- [x] G.4 Brand-scan (clean); no Changeset (zero published-package impact: storybook config + repo-root config + docs); PR
- [ ] ~~R.5 settings/token-theme/contexts~~ → **moved to Batch L** (wiring lives in the `_app.tsx`/`ComponentProviders.tsx` refactor; see progress log 2026-07-22)

## Batch H — i18n + visibility systems

- [x] H.0 Create branch
- [x] H.1 R.6 `cms/language/**` — **already on `main`** (predates the fork; optoma deleted it). No port needed.
- [x] H.2 R.7 `cms/visibility/**` — **already on `main`**. Ported only the new generic generator `scripts/generateVisibilityFromPatterns.ts` (744 lines, self-contained: `fs`/`path` only, `mydesignsystem.com` placeholder IDs).
- [x] H.3 De-brand: `--layer` default `"optoma"` → `visibility` (2 lines; only brand refs in the file).
- [x] H.4 Typecheck green (single-file `tsc --noEmit`), brand-scan clean. **No changeset** — only changed package is the website (`@kickstartds/ruhmesmeile-storyblok-starter`), which is in the changeset `ignore` list. PR.

## Batch I — book-a-demo

- [x] I.0 Create branch (`upstream/batch-i-book-a-demo`)
- [x] I.1 Port `components/book-a-demo/**` (R.4, 3 files: `BookADemoComponent.tsx`, `book-a-demo.scss`, `book-a-demo-tokens.scss`) + `packages/website/index.scss` `@use` line (global SCSS include, per repo convention)
- [x] I.2 No story/demo content to de-brand — website component (no Storybook, no schema); default label `"Book a Demo"` already generic. Verified diff direction first (ADR-012): all 3 files are **insertions** (new on optoma, absent on main)
- [x] I.3 Brand-scan clean; component mirrors existing `TimelineComponent.tsx` (`classnames` transitive dep resolves). **No changeset** (only changed package = website, changeset-`ignore`d). PR. Render wiring (`_app.tsx` + settings/page props) is settings-driven → **Batch L**

## Batch J — Footer redesign

- [ ] J.0 Create branch
- [ ] J.1 Port design-system `components/footer/**` redesign (`navItems` → `navGroups`, byline removal) (R.11, 4 files)
- [ ] J.2 Rewrite Footer story brand-neutral (placeholder nav groups) — story-coupled, required for search-index
- [ ] J.3 Fold in website-level `components/footer/FooterComponent.tsx` + `footer.scss` (R.8 subset) if paired
- [ ] J.4 Validate `build` + `build-storybook` (search-index); Changeset + PR

## Batch K — SharePoint integration

- [ ] K.0 Create branch
- [ ] K.1 Port `packages/storyblok-sharepoint-folder-picker-field-plugin/**` (R.1, 11 files)
- [ ] K.2 Port `website/helpers/sharepoint.ts` + `pages/api/sharepoint/**` (R.1, 2 files)
- [ ] K.3 Port SharePoint ADR/PRD/checklist docs if brand-neutral
- [ ] K.4 De-brand any Optoma-specific config/defaults; brand-scan
- [ ] K.5 Validate build; Changeset + PR

## Batch L — settings/token-theme wiring + R.8 remaining website component diffs (after closer look)

- [ ] L.0 Manual read of `_app.tsx` (+174/−84) and `ComponentProviders.tsx` (+291/−66) refactors, plus `header/nav-header-cta.scss`, `header/header.scss`, `Page.tsx`, `section/**`, `timeline/TimelineProps.ts`, `prompter/**`, to disentangle generic vs brand
- [ ] L.1 Port R.5 self-contained modules (`SettingsContext.tsx`, `HeaderButtonContext.tsx`, `settings/**`, `token-theme/**`) **with** their settings/token-theme wiring hunks from `_app.tsx`/`ComponentProviders.tsx` (coordinate book-a-demo pieces with Batch I; exclude `index.tsx` product-catalog hunks)
- [ ] L.2 Promote remaining confirmed-generic hunks to the branch
- [ ] L.3 Validate build; brand-scan; Changeset + PR

---

## Progress log

| Date       | Batch | Note                                                                                                                                                                                        |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-21 | —     | Checklist + ADR created; starting Batch A.                                                                                                                                                  |
| 2026-07-21 | A     | Investigated diffs (A.1 done). Split off token-graph wiring → Batch B (ADR-004). Excluded Storybook font/favicon brand changes (ADR-006). Catalogs to be regenerated, not copied (ADR-005). |
| 2026-07-21 | A     | Ported tooling; regenerated catalogs (component: 49 comps/776 tokens; semantic: 950 tokens, brand-neutral). Full DS build green (presets 136 passed). Changeset added. Ready to commit/PR.  |
| 2026-07-21 | B     | Ported `packages/token-graph` (18 files) + cosmos docs; stacked on Batch A branch (ADR-007). Wired token-graph build step + workspace dep + rollup copy (completes deferred A.y). DS build green; token-graph.json 1708 nodes/1988 edges (matches optoma); typecheck green. Changeset added.                    |
| 2026-07-21 | A+B   | Merged PR #6 (Batch A) + #7 (Batch B) into main locally (`gh` API auth broken → local merge commits + branch delete; deviation from ADR-007 squash noted). Merged-main DS build green. `main` pushed `446f2220..09026ec5`.                                                                                     |
| 2026-07-21 | C     | Merged PR #8 (Batch C) into main locally (`gh` API broken → local merge commit + branch delete). `main` pushed `09026ec5..4f2a2354`.                                                                                                                                                                        |
| 2026-07-21 | D     | Ported 37 brand-neutral component files (new `SeoComponent.tsx`, `Gallery.client.js`; gallery slider / lightbox stroke+thumb / teaser-card image tokens) off updated main. Excluded 44 brand-laden stories + story-coupled Footer redesign (ADR-008 → backlog R.11). Regenerated `component-token-catalog.json` + `SectionProps.d.ts` (deterministic). LFS snapshots/screenshots deferred to CI — local regen = env drift 141/157 incl. untouched leaves (ADR-009). `build` green (presets 136 passed); `build-storybook` green. Brand scan clean. Changeset added (`@kickstartds/design-system` minor). |
| 2026-07-21 | D     | Story-diff audit: 42/44 pure brand-content swaps; 2 brand-neutral carve-outs **folded into Batch D** (R.12) — gallery `SliderGallery` (covers ported slider layout) + business-card `contact:`→`contactLinks:` (latent template-story bug). `build` green (presets 137); search-index green (108). Merged PR #9 into main locally (`gh` API broken → merge commit + branch delete). `main` pushed `4f2a2354..f920f881`. |
| 2026-07-21 | E     | Ported 3 pnpm patches (new `unpic@3.22.0` Storyblok filter-parser fix, new `kickstartds@3.5.0--canary.62.324.0` storyblok-task rc-config fix, extended `jsonschema-utils@3.9.0` allOf title/desc/required preservation) + 2 `patchedDependencies` entries. Both new versions resolve in lockfile; `pnpm install` registered patch hashes. All patches brand-neutral. DS build green (presets 137), no output churn. Changeset = `@kickstartds/design-system` patch; pnpm-patch-only batch changeset policy recorded (ADR-010). |
| 2026-07-22 | E     | Merged PR #10 into `main` locally (`gh` API broken → `--no-ff` merge commit + branch delete). `main` pushed `6f1f47e4..29ca0650`. |
| 2026-07-22 | F     | Scoped Batch F to 5 brand-neutral files: per-component token overrides for theme create/update (`storyblok-mcp` config/register-tools/services, `storyblok-services` index/themes). Icon-picker plugin (`App.tsx` `allowedIcons` filter + dist) and `transform.ts` numeric-`component` fix were **already on `main`** from earlier batches (`main` == `optoma` for those). Both packages build green, no generated churn. Changeset = minor bump `@kickstartds/storyblok-services` + `@kickstartds/storyblok-mcp-server`. |
| 2026-07-22 | F     | Merged PR #11 into `main` locally (`gh` API broken → `--no-ff` merge commit + branch delete). `main` pushed `29ca0650..c9056003`. Discarded recurring format-on-save churn (emphasis `*`→`_`, trailing-comma removal) on 4 unrelated files before merge. |
| 2026-07-22 | —     | REVIEW backlog dispositions decided (ADR-011). **PORT:** R.1 SharePoint (→K), R.4 book-a-demo (→I), R.5 infra contexts (→G), R.6 i18n (→H), R.7 visibility (→H, de-brand `--layer` default), R.9 `.vscode/settings.json` (→G), R.10 a11y toggle (→G), R.11 footer redesign (→J). **EXCLUDE (Optoma-specific):** R.2 datasheet, R.3 spec/downloads, R.9 `ingest-template.ts` + hero-slider workflow doc. **CLOSER LOOK:** R.8 (→L). New batch plan G→L added above. |
| 2026-07-22 | —     | Two refinements after reviewing the files: (1) `hero-slider-workflow-improvements.md` re-classified **EXCLUDE → PORT (→G)** — despite the title it is generic MCP/tooling feedback (no brand content); mark historical (several points already resolved here). Only `ingest-template.ts` stays excluded from R.9. (2) R.7 de-brand target fixed: `--layer` default `"optoma"` → **`visibility`** (no built-in customization layer). |
| 2026-07-22 | G     | Ported 3 standalone items: `.storybook/preview.tsx` a11y `test: "off"` toggle (R.10), `.vscode/settings.json` watcher/search/explorer excludes (R.9), `hero-slider-workflow-improvements.md` + historical banner (R.9). Brand-scan clean. **No changeset** — zero published-package impact (storybook config not shipped in `dist`, repo-root config, docs). **R.5 re-scoped G → L**: settings/token-theme/context modules are self-contained but their functional wiring lives in the entangled `_app.tsx` (+174/−84) + `ComponentProviders.tsx` (+291/−66) refactors (coupled to book-a-demo/Batch I); `index.tsx` diff is pure product-catalog (excluded). Settings feature will port whole in Batch L. Merged PR #12 locally; `main` `ac611525..a03d4607`. |
| 2026-07-22 | H     | **Scope collapsed ~75 files → 1.** Diff-direction correction: `cms/language/**` (37) and `cms/visibility/**` (37) already exist on `main` (added at the mono-repo move `214d70fd`, predating the fork base `6e67004a`); optoma **deleted** the generic layers and replaced them with the brand layer `cms/optoma/**` (excluded). The only genuinely-new generic artifact is the generator script `scripts/generateVisibilityFromPatterns.ts` (+744, not on main, not wired into package.json — run via `npx tsx`). Ported it; de-branded `--layer` default `"optoma"` → `visibility` (the file's only brand refs). Single-file typecheck green; brand-scan clean. **No changeset** (website is changeset-`ignore`d). |
| 2026-07-22 | H     | Merged PR #13 into `main` locally (`gh` API broken → `--no-ff` merge commit + branch delete). `main` pushed `a03d4607..04e5ca28`. |
| 2026-07-22 | I     | Ported book-a-demo as a self-contained, brand-neutral component: `components/book-a-demo/**` (3 files — floating "Book a Demo" fixed-position button, all `--ks-`/`--dsa-` tokens) + `index.scss` `@use`. Verified diff direction first (ADR-012): all 3 files are insertions (new on optoma). No story/schema (website component, not a Storyblok blok) — default label already generic, nothing to de-brand. Functional render wiring (`_app.tsx` `<BookADemo>` driven by `settings?.bookDemoButton_*` + `hideBookDemoButton`) and the `settings`/`page` prop additions are **settings-coupled → deferred to Batch L** (component ships dormant until then). Brand-scan clean. **No changeset** (only changed package = website, changeset-`ignore`d). |
