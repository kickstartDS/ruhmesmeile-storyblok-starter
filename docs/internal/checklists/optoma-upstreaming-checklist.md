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
- [~] A.12 Committed (`bd6f437e`); push + open PR pending user go-ahead
- [-] A.x `.storybook` font/favicon swap — **excluded** (brand, ADR-006)
- [ ] A.y `token-graph` build wiring + workspace dep + `token-graph.json` copy — **moved to Batch B**

## Batch B — Cosmos Token Graph (new package)

- [ ] B.0 Create branch
- [ ] B.1 Port `packages/token-graph/**`
- [ ] B.2 Port ADR/PRD/checklist docs
- [ ] B.3 Wire workspace + build; validate
- [ ] B.4 Changeset + PR

## Batch C — Component Token Editor

- [ ] C.0 Create branch
- [ ] C.1 Port `design-tokens-editor/src/{component-editor,graph,preview-page}/**`
- [ ] C.2 Review remaining `design-tokens-editor` + `design-tokens-mcp` diffs
- [ ] C.3 Port ADR/PRD/checklist docs
- [ ] C.4 Build + validate
- [ ] C.5 Changeset + PR

## Batch D — Design-system component fixes

- [ ] D.0 Create branch
- [ ] D.1 Port component `*.tsx` / `*.scss` / `*.schema.json` (strip brand token values)
- [ ] D.2 Regenerate LFS snapshots + screenshots locally
- [ ] D.3 Build + Storybook a11y check
- [ ] D.4 Changeset + PR

## Batch E — Dependency & patch updates

- [ ] E.0 Create branch
- [ ] E.1 Port `patches/unpic@3.22.0.patch`
- [ ] E.2 Port `patches/kickstartds@3.5.0--canary.62.324.0.patch`
- [ ] E.3 Update `package.json` `patchedDependencies`
- [ ] E.4 `pnpm install` to regenerate lockfile
- [ ] E.5 Changeset + PR

## Batch F — Generic plugins/tooling

- [ ] F.0 Create branch
- [ ] F.1 Port `storyblok-icon-sprite-picker-field-plugin/**`
- [ ] F.2 Review + port `storyblok-mcp` / `storyblok-services` hunks
- [ ] F.3 Changeset + PR

## REVIEW backlog (promote to a batch after decision)

- [ ] R.1 SharePoint folder-picker plugin + helpers/api
- [ ] R.2 Datasheet PDF generation
- [ ] R.3 spec-group / download-category / downloads
- [ ] R.4 book-a-demo
- [ ] R.5 settings / token-theme / infra contexts
- [ ] R.6 `cms/language` i18n system
- [ ] R.7 `cms/visibility` system
- [ ] R.8 website components root diffs (header/footer/page/section/timeline/prompter)
- [ ] R.9 misc (`ingest-template.ts`, `.vscode/settings.json`, workflow docs)
- [ ] R.10 Storybook `a11y: { test: "off" }` toggle + a11y-interaction-tests addon (`.storybook/preview.tsx`)

---

## Progress log

| Date | Batch | Note |
| ---- | ----- | ---- |
| 2026-07-21 | — | Checklist + ADR created; starting Batch A. |
| 2026-07-21 | A | Investigated diffs (A.1 done). Split off token-graph wiring → Batch B (ADR-004). Excluded Storybook font/favicon brand changes (ADR-006). Catalogs to be regenerated, not copied (ADR-005). |
| 2026-07-21 | A | Ported tooling; regenerated catalogs (component: 49 comps/776 tokens; semantic: 950 tokens, brand-neutral). Full DS build green (presets 136 passed). Changeset added. Ready to commit/PR. |
