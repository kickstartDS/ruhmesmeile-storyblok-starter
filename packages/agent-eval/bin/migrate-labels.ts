/**
 * Split stored notes into reason ids plus residue.
 *
 * Exact-match only, on the ", " join the writer used. A label contains no
 * comma by rule, so a segment either is one verbatim or it is free text, and
 * anything that does not match is kept rather than guessed at.
 *
 * Re-runnable, and worth re-running after a `labels:pull`: a label already
 * carrying `reasons` is skipped, so the only thing it touches is work graded
 * against a deployment that has not caught up yet.
 *
 *   pnpm --filter agent-eval exec tsx bin/migrate-labels.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { REASONS } from "../lib/judge/reasons";

const DIR = fileURLToPath(new URL("../calibration/labels", import.meta.url));

const byLabel = new Map(REASONS.map((reason) => [reason.label, reason.id]));

for (const file of readdirSync(DIR).filter((name) => name.endsWith(".json"))) {
  const path = join(DIR, file);
  const labels = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    Record<string, unknown> & { note: string; reasons?: string[] }
  >;

  let touched = 0;

  for (const [key, label] of Object.entries(labels)) {
    if (label.reasons) continue;

    const ids: string[] = [];
    const residue: string[] = [];

    for (const part of label.note.split(", ").filter(Boolean)) {
      const id = byLabel.get(part);
      if (id) ids.push(id);
      else residue.push(part);
    }

    labels[key] = {
      verdict: label.verdict,
      reasons: ids,
      note: residue.join(", "),
      address: label.address,
      rubric: label.rubric,
      labelledAt: label.labelledAt,
      rater: label.rater,
    } as never;

    touched += 1;
    console.log(
      `${key}\n  ids: ${ids.join(" ") || "(none)"}\n  note: ${residue.join(", ") || "(empty)"}`,
    );
  }

  if (touched) writeFileSync(path, `${JSON.stringify(labels, null, 2)}\n`);
  console.log(`${file} \u2014 ${touched} migrated`);
}
