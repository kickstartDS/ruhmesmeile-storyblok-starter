/**
 * 3.6 / 3.7 — the hand-grading CLI.
 *
 * Costs nothing and calls nothing. It reads the same material the judge was
 * given, asks for a verdict on the same three-way scale, and stores the answer
 * in `calibration/labels.json`.
 *
 *   pnpm calibrate            # grade the next unlabelled pair
 *   pnpm calibrate --report   # agreement, kappa, and every disagreement
 *   pnpm calibrate --status   # how much of the grid has been graded
 *
 * The judge's verdict is withheld while grading and shown immediately after, so
 * that a disagreement is noticed while the code is still in mind — that reveal
 * is where the diagnosis gets written, and the note on a disagreement is the
 * most valuable field in the file.
 */

import { createInterface } from "node:readline/promises";

import {
  agreement,
  candidates,
  queue,
  raterAgreement,
  readLabels,
  readRaters,
  writeLabel,
  type Item,
} from "../lib/judge/calibration";
import { highlight } from "../lib/judge/highlight";
import { reasonsFor, resolveReasons } from "../lib/judge/reasons";
import { referenceCorpus } from "../lib/judge/corpus";
import { loadTokenRegistry } from "../lib/graders/tokens";
import type { Verdict } from "../lib/judge/run";
import { RUBRICS } from "../lib/judge/rubrics";

const ANSWERS: Record<string, Verdict> = {
  p: "pass",
  f: "fail",
  u: "unknown",
};

function report(): void {
  const items = candidates();
  const labels = readLabels();
  const results = agreement(items, labels);

  if (!results.length) {
    console.log("No labels yet. Run `pnpm calibrate` to grade a pair.");
    return;
  }

  const total = results.reduce((sum, r) => sum + r.n, 0);
  const agreed = results.reduce((sum, r) => sum + r.agreed, 0);

  console.log(`\nAgreement — ${agreed}/${total} overall\n`);
  for (const result of results) {
    const gate = result.rate >= 0.8 ? "✓" : "✗";
    // Clearing the bar and carrying weight are two different things: the flag
    // is set by hand once a rubric's agreement has been read and believed, so
    // a rubric can sit at 100% here and still be marked `not scored` until
    // someone flips it. See `Rubric.calibrated` (D-112).
    const weighted = RUBRICS.find((r) => r.id === result.rubric)?.calibrated
      ? ""
      : "  [not scored]";
    console.log(
      `  ${gate} ${result.rubric.padEnd(18)} ${(result.rate * 100).toFixed(0).padStart(3)}%  ` +
        `(${result.agreed}/${result.n})  kappa ${result.kappa.toFixed(2)}${weighted}`,
    );
  }

  console.log("\nConfusion (human → judge)");
  for (const result of results) {
    const cells = Object.entries(result.confusion)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cell, n]) => `${cell} ${n}`)
      .join("   ");
    console.log(`  ${result.rubric.padEnd(18)} ${cells}`);
  }

  // Identical code answered two different ways is the judge disagreeing with
  // itself, and no amount of rubric wording pushes agreement above that floor.
  const noisy = results.filter(
    (r) => r.repeated.groups > r.repeated.consistent,
  );
  if (noisy.length) {
    console.log("\nSelf-consistency on identical code");
    for (const result of noisy)
      console.log(
        `  ${result.rubric.padEnd(18)} ${result.repeated.consistent}/${result.repeated.groups} repeated components answered the same way`,
      );
  }

  // The other floor: two people on the same material. Human/judge agreement has
  // no error bar without it — a rubric humans themselves only agree 70% on is
  // not a rubric the judge is failing. Deliberately deferred while coverage is
  // the bottleneck, so its absence is reported as a caveat, not a fault.
  const raters = readRaters();
  const between = raterAgreement(raters);

  if (Object.keys(raters).length < 2) {
    console.log(
      `\nOne rater (${Object.keys(raters).join(", ") || "none"}) — the numbers above have no error bar.` +
        "\n  Fine while coverage is the goal; the ceiling needs a second grader on the same pairs.",
    );
  } else if (!between.length) {
    console.log(
      `\n${Object.keys(raters).length} raters, no overlap — expected, the queue is shared so nobody` +
        "\n  regrades an answered pair. The ceiling needs the same pair graded twice on purpose.",
    );
  } else {
    console.log("\nBetween raters (the ceiling)");
    for (const result of between)
      console.log(
        `  ${result.rubric.padEnd(18)} ${Math.round(result.rate * 100)}%  (${result.agreed}/${result.n})  kappa ${result.kappa.toFixed(2)}`,
      );
    for (const result of between)
      for (const split of result.splits)
        console.log(
          `    split  ${result.rubric}  ${split.address}  ` +
            Object.entries(split.verdicts)
              .map(([name, verdict]) => `${name}=${verdict}`)
              .join(" "),
        );
  }

  const disagreements = results.flatMap((r) =>
    r.disagreements.map((d) => ({ ...d, rubric: r.rubric })),
  );

  if (disagreements.length) {
    console.log(
      `\nDisagreements (${disagreements.length}) — the iteration list`,
    );
    for (const d of disagreements) {
      console.log(`\n  ${d.rubric}  ${d.address}`);
      console.log(`    human ${d.human}${d.note ? ` — ${d.note}` : ""}`);
      console.log(`    judge ${d.judge} — ${d.reason}`);
    }
  }

  console.log(
    "\n3.7 needs every rubric at 80% or better before the judge is weighted.",
  );
}

function status(): void {
  const items = queue(candidates());
  const labels = readLabels();
  const done = items.filter((item) => labels[item.key]).length;

  console.log(
    `${done}/${items.length} distinct components graded (${candidates().length} trial-rubric pairs, deduplicated).`,
  );

  const byRubric = new Map<string, [number, number]>();
  for (const item of items) {
    const [d, t] = byRubric.get(item.rubric.id) ?? [0, 0];
    byRubric.set(item.rubric.id, [d + (labels[item.key] ? 1 : 0), t + 1]);
  }
  for (const [rubric, [d, t]] of byRubric)
    console.log(`  ${rubric.padEnd(18)} ${d}/${t}`);
}

function show(item: Item, index: number, remaining: number): void {
  console.log(`\n${"─".repeat(72)}`);
  console.log(`Pair ${index} — ${remaining} unlabelled remaining`);
  console.log(`Task: ${item.trial.evalName}`);
  console.log(`${"─".repeat(72)}`);
  console.log(`\nCriterion:\n${item.rubric.criterion}`);

  // The brief reaches the judge through the *prompt*, not the material, and the
  // material is all this screen ever printed — so on `design-intent` the judge
  // read the task and the human guessed at it. Agreement between two graders
  // holding different evidence is not a measurement of the rubric, and it caps
  // below 100% by construction (D-123).
  //
  // Shown, never keyed: `material` still decides `labelKey`, so surfacing this
  // costs no labels. It is deliberately withheld where the judge does not get
  // it either, because handing the human *more* than the judge breaks the
  // comparison just as thoroughly in the other direction.
  if (item.rubric.include.prompt) {
    const brief = item.trial.files.get("PROMPT.md");
    if (brief) console.log(`\nThe brief the author was given:\n${brief}`);
  }

  console.log(highlight(item.material));

  // The other half of D-123, and the larger half. The judge gets the reference
  // components in a cached system block; this screen never showed them, while
  // the criterion it prints says "the reference components are the local idiom"
  // and "judge the candidate against them". A reader told to compare against an
  // exhibit they cannot see does not abstain — they compare against the
  // conventions they already hold, which is what the retired design-intent
  // notes are made of (D-127).
  if (item.rubric.include.exemplars) console.log(highlight(referenceCorpus()));

  // Not printed: 1457 names, looked up rather than read, and dumping them
  // before every pair would push the criterion off screen — the failure this
  // whole change exists to stop. The browser has them behind a disclosure; here
  // it is a pointer, and the tokens are a grep away in a checkout.
  if (item.rubric.include.tokenNames) {
    const registry = loadTokenRegistry();
    if (registry.loaded)
      console.log(
        `\n(the judge also had all ${registry.semantic.size} semantic token names;` +
          ` /calibrate shows them in full)`,
      );
  }

  console.log(`${"─".repeat(72)}`);
}

/**
 * The diagnosis, as picked ids plus whatever is specific to this one.
 *
 * The list is only offered on a non-pass. A `pass` note is rare and never a
 * diagnosis — both of the passes labelled so far have an empty note — so
 * printing nine failure modes before every one of them would be pure noise in
 * the loop this is meant to speed up.
 *
 * The free-text prompt always follows. Reusing the common phrasing is the
 * point, but the residue is where the new information is, and a picker that
 * made it awkward to add would quietly turn every diagnosis into one of nine —
 * which is also how the dictionary grows, since every entry in it was
 * transcribed out of this prompt.
 */
async function composeNote(
  verdict: Verdict,
  rubric: string,
  ask: (prompt: string) => Promise<string | null>,
): Promise<{ reasons: string[]; note: string }> {
  const picked: string[] = [];

  if (verdict !== "pass") {
    // Scoped to the rubric: offering a diagnosis the question does not ask
    // about is how every design-intent label before this became a code-idiom
    // label wearing the wrong name.
    const offered = reasonsFor(rubric);

    if (offered.length) {
      console.log("\n  common reasons:");
      for (const [i, reason] of offered.entries())
        console.log(`   ${String(i + 1).padStart(2)}  ${reason.label}`);
    } else {
      console.log(
        "\n  no canned reasons for this rubric yet — write one below.",
      );
    }

    const selection = (await ask("reasons (numbers, blank for none): ")) ?? "";
    const { ids, invalid } = resolveReasons(selection, rubric);
    if (invalid.length)
      console.log(`  ignored (not in the list): ${invalid.join(" ")}`);
    picked.push(...ids);
  }

  const extra =
    (await ask(picked.length ? "anything else: " : "note (optional): ")) ?? "";

  return { reasons: picked, note: extra.trim() };
}

async function grade(): Promise<void> {
  const labels = readLabels();
  const pending = queue(candidates()).filter((item) => !labels[item.key]);

  if (!pending.length) {
    console.log(
      "Everything is graded. `pnpm calibrate --report` for agreement.",
    );
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // The async iterator rather than `rl.question`: the iterator pauses the input
  // between reads, where `question` only captures the next line *while it is
  // waiting* and silently drops anything that arrives in between. That costs
  // nothing when a human is typing and everything when the session is piped,
  // which is the only way this loop can be tested.
  const input = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string): Promise<string | null> => {
    process.stdout.write(prompt);
    const { value, done } = await input.next();
    return done ? null : String(value).trim();
  };

  try {
    for (const [index, item] of pending.entries()) {
      show(item, index + 1, pending.length - index);

      const answer = (
        await ask("verdict — (p)ass / (f)ail / (u)nknown / (s)kip / (q)uit: ")
      )?.toLowerCase();

      if (answer === undefined || answer === null || answer === "q") break;
      if (answer === "s") continue;

      const verdict = ANSWERS[answer];
      if (!verdict) {
        console.log("Not a verdict — skipping.");
        continue;
      }

      // Revealed only now. Before the answer it would be an anchor; after it,
      // it is the prompt for the note that explains the disagreement.
      if (item.judged) {
        const same = item.judged.verdict === verdict;
        console.log(
          `\n  judge said ${item.judged.verdict} ${same ? "— agrees" : "— DISAGREES"}`,
        );
        console.log(`  ${item.judged.reason}`);
      } else {
        console.log("\n  (not judged yet)");
      }

      const { reasons, note } = await composeNote(verdict, item.rubric.id, ask);

      writeLabel(item.key, {
        verdict,
        reasons,
        note,
        address: item.address,
        rubric: item.rubric.id,
        labelledAt: new Date().toISOString(),
      });
    }
  } finally {
    rl.close();
  }

  console.log("\nSaved to calibration/labels.json.");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--report")) return report();
  if (argv.includes("--status")) return status();
  await grade();
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
