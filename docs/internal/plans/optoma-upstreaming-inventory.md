# Optoma → Template Upstreaming Inventory

> **Goal:** Port the _generic_ improvements made in the `optoma-website` fork back into this
> template repo (`ruhmesmeile-storyblok-starter`), while excluding everything that is specific to
> the Optoma client project.
>
> **Status:** Inventory / planning. No code ported yet.

## Method

- Fork point (merge-base) of the two histories: `6e67004a` (_"fix: align preview and build versions
  of page fetching"_).
- Optoma tip analyzed: `optoma/main` @ `b24f30ed` (_"fix: hero spotlight features"_).
- Divergence surface: **858 files** changed (`244 A`, `510 M`, `89 D`, plus a handful of renames).
- Regenerate the raw data anytime with:

  ```bash
  git diff --name-status 6e67004a optoma/main   # per-file A/M/D
  git diff --stat        6e67004a optoma/main   # line churn
  ```

Every path below is bucketed into one of three categories:

| Legend         | Meaning                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| ✅ **GENERIC** | Reusable improvement — upstream it (strip any brand values first).             |
| ⛔ **OPTOMA**  | Client-specific — never upstream.                                              |
| 🔍 **REVIEW**  | Mixed / decision needed — cherry-pick hunks, keep structure, drop client bits. |

---

## Summary by area

| Area                                                                                                                                         | Files | Category | Notes                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----: | -------- | ---------------------------------------------------------------------------------- |
| `packages/design-system/src/components/**` (~44 dirs)                                                                                        |   101 | ✅ / 🔍  | Component fixes = generic; per-component `_*-tokens.scss` **values** may be brand. |
| `packages/design-system/scripts/**`                                                                                                          |     6 | ✅       | Token tooling (`tokensToCss`, `componentTokensToCss`, catalog extractors).         |
| `packages/design-system/src/token/*catalog*.json`, `token-graph.json`                                                                        |     3 | ✅       | Generated catalogs supporting new tooling.                                         |
| `packages/design-system/src/token/branding-tokens.*`, `fonts.css`, `_fonts.scss`, `token-dsa/typo.json`, `themes/index.ts`                   |     6 | ⛔ / 🔍  | Structure may be generic, **values are Optoma brand**.                             |
| `packages/design-system/static/img/optoma/**`                                                                                                |    55 | ⛔       | Client imagery.                                                                    |
| `packages/design-system/static/{fonts,favicon,logo*}`                                                                                        |   ~34 | ⛔       | Brand fonts (HelveticaNeue) + logos/favicons.                                      |
| `packages/design-system/static/img/screenshots/**`                                                                                           |   157 | ⚠️       | **Regenerate locally** — do NOT copy (LFS).                                        |
| `packages/design-system/__snapshots__/**`                                                                                                    |   157 | ⚠️       | **Regenerate locally** — do NOT copy (LFS).                                        |
| `packages/token-graph/**` (new package)                                                                                                      |    18 | ✅       | "Cosmos Token Graph" feature. Has ADR + PRD.                                       |
| `packages/design-tokens-editor/src/{component-editor,graph,preview-page}/**`                                                                 |    21 | ✅       | "Component Token Editor" feature. Has ADR + PRD.                                   |
| `packages/design-tokens-mcp/**`                                                                                                              |     4 | ✅ / 🔍  | Tooling for token features.                                                        |
| `packages/storyblok-{services,mcp}/**`                                                                                                       |     6 | 🔍       | Review individual hunks.                                                           |
| `packages/storyblok-icon-sprite-picker-field-plugin/**`                                                                                      |     2 | ✅       | Existing generic plugin.                                                           |
| `packages/storyblok-sharepoint-folder-picker-field-plugin/**` (new package)                                                                  |    11 | 🔍       | Reusable plugin, but SharePoint = enterprise integration.                          |
| `packages/umami-analytics/**`                                                                                                                |     3 | ⛔       | Env/config.                                                                        |
| `packages/website/cms/optoma/**`                                                                                                             |    31 | ⛔       | Client CMS schema overrides.                                                       |
| `packages/website/cms/{language,visibility}/**`                                                                                              |    59 | 🔍       | i18n + visibility system — likely generic infra.                                   |
| `packages/website/public/products/**`, `public/blurhashes/**`                                                                                |   ~51 | ⛔       | Product data + generated blurhashes.                                               |
| `packages/website/helpers/netsuite/**`                                                                                                       |     8 | ⛔       | NetSuite product ingest.                                                           |
| `packages/website/helpers/sharepoint.ts`, `pages/api/sharepoint/**`                                                                          |     2 | 🔍       | Paired with SharePoint plugin.                                                     |
| `packages/website/components/{datasheet,spec-group,download-category,downloads}/**`                                                          |   ~14 | 🔍       | Product datasheet/spec/download features.                                          |
| `packages/website/components/book-a-demo/**`                                                                                                 |     3 | 🔍       | Marketing component — generic-able.                                                |
| `packages/website/components/{ProductDetail,cms/product-detail*}`, `pages/products/**`, `scripts/ingest-*`                                   |    ~8 | ⛔       | Product catalog.                                                                   |
| `packages/website/components/{settings,token-theme,HeaderButtonContext,SettingsContext}`                                                     |    ~6 | 🔍       | Infra contexts — likely generic.                                                   |
| `patches/{unpic,kickstartds canary}.patch`, `pnpm-lock.yaml`, `package.json`                                                                 |     4 | ✅       | Dependency/patch updates.                                                          |
| Root infra: `.circleci`, `.dockerignore`, `.kamal/secrets`, `config/deploy-*.yml`, `.vscode/settings.json`, `.env*`, `.cms-storyblokrc.json` |   ~10 | ⛔ / 🔍  | Client infra & secrets.                                                            |
| `docs/{adr,internal}/**`                                                                                                                     |    14 | ✅ / 🔍  | Keep generic feature docs; drop product-specific plans.                            |

---

## ✅ GENERIC — upstream these (batched)

### Batch A — Build & token tooling

- `packages/design-system/scripts/tokensToCss.mjs` + `tokensToCss.d.mts`
- `packages/design-system/scripts/componentTokensToCss.mjs` + `componentTokensToCss.d.mts`
- `packages/design-system/scripts/extractComponentTokenCatalog.cjs`
- `packages/design-system/scripts/extractSemanticTokenCatalog.cjs`
- `packages/design-system/src/scss.d.ts`
- `packages/design-system/src/token/component-token-catalog.json`
- `packages/design-system/src/token/semantic-token-catalog.json`
- `packages/design-system/src/token/token-graph.json`
- `packages/design-system/rollup.config.mjs` _(review hunks — may reference brand assets)_
- `packages/design-system/.storybook/*` _(review — may carry brand head/preview tweaks)_

### Batch B — New feature: Cosmos Token Graph

- `packages/token-graph/**` (entire new package, 18 files)
- `docs/adr/adr-cosmos-token-graph.md`
- `docs/internal/prd/cosmos-token-graph-prd.md`
- `docs/internal/checklists/cosmos-token-graph-checklist.md`

### Batch C — New feature: Component Token Editor

- `packages/design-tokens-editor/src/component-editor/**` (5 files)
- `packages/design-tokens-editor/src/graph/GraphView.tsx`
- `packages/design-tokens-editor/src/preview-page/ComponentPreviewPage.tsx`
- remaining `packages/design-tokens-editor/**` diffs _(review)_
- `packages/design-tokens-mcp/**` _(review — supporting tooling)_
- `docs/adr/adr-component-token-editor.md`
- `docs/internal/prd/component-token-editor-prd.md`
- `docs/internal/checklists/component-token-editor-checklist.md`

### Batch D — Design-system component fixes

Component dirs touched (port `*.tsx` / `*.scss` / `*.schema.json`; **skip brand token _values_**):

`blog-aside blog-author blog-head blog-teaser breadcrumb business-card button cms contact
content-nav cta downloads event-filter event-header event-latest event-latest-teaser
event-list-teaser event-location event-registration faq feature features footer gallery header
headline hero html image-story image-text lightbox logos mosaic pagination search-filter
search-result section seo slider split-even split-weighted stats teaser-card testimonials text
video-curtain`

Notable additions here that are clearly generic:

- `packages/design-system/src/components/seo/SeoComponent.tsx`
- `packages/design-system/src/components/gallery/Gallery.client.js`

### Batch E — Dependency & patch updates

- `patches/unpic@3.22.0.patch`
- `patches/kickstartds@3.5.0--canary.62.324.0.patch`
- corresponding `package.json` `patchedDependencies` entries
- `pnpm-lock.yaml` deltas (regenerate via `pnpm install` after the above)

### Batch F — Generic plugins/tooling

- `packages/storyblok-icon-sprite-picker-field-plugin/**`
- `packages/storyblok-mcp/**`, `packages/storyblok-services/**` _(review each hunk)_

---

## ⛔ OPTOMA-SPECIFIC — never upstream

- **Imagery:** `packages/design-system/static/img/optoma/**` (55), `logo.svg`, `logo-inverted.svg`,
  `logo-dark.svg`, `favicon*`, `static/favicon/**`.
- **Brand fonts:** `packages/design-system/static/fonts/HelveticaNeue-*`.
- **Brand token values:** `branding-tokens.css`, `branding-tokens.json`, `fonts.css`, `_fonts.scss`,
  `token-dsa/dictionary/typo.json` (upstream the _structure_ only if needed, never the values).
- **Client CMS schema:** `packages/website/cms/optoma/**` (31).
- **Product catalog:** `packages/website/public/products/**`, `pages/products/**`,
  `components/ProductDetail.tsx`, `components/cms/product-detail.schema.json` + `ProductDetailProps.ts`,
  `scripts/ingest-products*.ts`, `scripts/ingest-products-csv.ts`.
- **NetSuite integration:** `packages/website/helpers/netsuite/**` (8).
- **Generated content:** `packages/website/public/blurhashes/**` (47).
- **Analytics/config:** `packages/umami-analytics/{.env,.env.local.example}`, `config/deploy-*.yml`,
  `.kamal/secrets`, `.circleci/config.yml`, `.dockerignore`, `.cms-storyblokrc.json`,
  `packages/website/.env.local.sample`.

## ⚠️ SPECIAL HANDLING — regenerate, never copy

- `packages/design-system/__snapshots__/**` (157) and `packages/design-system/static/img/screenshots/**`
  (157) are **Git LFS** artifacts. Copying Optoma's blobs is exactly what caused the LFS `404`
  during the merge (their OIDs don't exist on this repo's LFS server). After porting component
  changes, **regenerate** them here:

  ```bash
  pnpm --filter @kickstartds/design-system build-storybook
  pnpm --filter @kickstartds/design-system create-component-previews
  ```

  Then commit the updated `__snapshots__/` + `static/img/screenshots/` (via LFS).

---

## 🔍 REVIEW — decide per item

| Item                                                                                                | Files | Lean                 | Rationale                                                                                                     |
| --------------------------------------------------------------------------------------------------- | ----: | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| SharePoint folder-picker plugin + `helpers/sharepoint.ts` + `api/sharepoint/**` + ADR/PRD/checklist |   ~15 | Keep as optional pkg | Reusable field plugin, but SharePoint is an enterprise integration; upstream only if template should ship it. |
| `datasheet/**` (PDF generation) + `datasheet-pdf-plan.md`                                           |    ~7 | Generic-able         | Nice generic feature, but currently wired to product datasheets.                                              |
| `spec-group/**`, `download-category/**`, `downloads/**`                                             |    ~8 | Review               | Product spec/download tables — generic pattern, product-driven content.                                       |
| `book-a-demo/**`                                                                                    |     3 | Likely generic       | Marketing CTA component.                                                                                      |
| `settings/**`, `token-theme/**`, `SettingsContext.tsx`, `HeaderButtonContext.tsx`                   |    ~6 | Likely generic       | Infra contexts.                                                                                               |
| `cms/language/**` (37) + i18n wiring                                                                |    37 | Likely generic       | Multi-language infra — valuable for the template.                                                             |
| `cms/visibility/**` (22) + `scripts/generateVisibilityFromPatterns.ts`                              |    23 | Likely generic       | Conditional-visibility system.                                                                                |
| `website/components/{header,footer,page,section,timeline,prompter}` root diffs                      |   ~12 | Review               | Mixed generic fixes + brand markup.                                                                           |
| `helpers/ingest-template.ts`                                                                        |     1 | Review               | Content ingest helper.                                                                                        |
| `.vscode/settings.json`                                                                             |     1 | Review               | Editor config — usually safe/generic.                                                                         |
| `docs/internal/plans/hero-slider-workflow-improvements.md`                                          |     1 | Likely generic       | Workflow doc.                                                                                                 |

---

## Suggested execution sequence

1. **Batch A** (tooling) → prerequisite for token catalogs/graph.
2. **Batch E** (deps/patches) → `pnpm install` clean baseline.
3. **Batch D** (component fixes) → then regenerate LFS snapshots/screenshots.
4. **Batch B** (token-graph) and **Batch C** (component-token-editor) → independent features.
5. **Batch F** (plugins/MCP) → review hunks.
6. Work the **🔍 REVIEW** list, promoting items to GENERIC as decided.

Each batch = its own branch off clean `main` + a Changeset + one PR. Per-file mechanic:

```bash
git checkout optoma/main -- <path>   # stage optoma's version
git diff --cached -- <path>          # inspect; strip optoma specifics
# edit, then: pnpm changeset && commit
```

## Guardrails

- Never `git merge optoma main` — it drags in all client content and re-triggers the LFS 404.
- Never copy LFS blobs (`__snapshots__`, `screenshots`) from optoma — regenerate locally.
- Strip brand **values** from any ported token/scss files; keep only structural/logic changes.
