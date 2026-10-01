// Declared in cfg.extraEntries purely so the build's export-name scan can see
// the barrel's names (it source-scans extraEntries, but reads cfg.entry only
// through esbuild). Same module graph as ds-entry.mjs, so esbuild dedupes it —
// this adds names to the export gates, not a second copy of the library.
export * from "./ds-entry.mjs";
