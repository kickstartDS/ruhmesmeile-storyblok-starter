import { parseAddress, resolveTrials } from "../lib/address";
import { buildPrompt, cachedContext } from "../lib/judge/run";
import { RUBRICS } from "../lib/judge/rubrics";

const rubric = RUBRICS.find((entry) => entry.id === "design-intent")!;

const trial = resolveTrials(
  parseAddress("cc-none-sonnet-high/812-restyle-with-tokens/run-2"),
)[0]!;

console.log("trial:", trial.runDir);
console.log("files:", [...trial.files.keys()].join(", "));

const prompt = buildPrompt(trial, rubric)!;
const shared = cachedContext(rubric) ?? "";

const count = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

for (const [name, text] of [
  ["per-trial prompt", prompt],
  ["cached context", shared],
] as const) {
  console.log(
    `\n${name}: ${text.length} chars, "--dsa-"x${count(text, "--dsa-")}, "--ks-"x${count(text, "--ks-")}`,
  );
  console.log(
    "  file sections:",
    [...text.matchAll(/-{5} (.+?) -{5}/g)].map((m) => m[1]).join(" | ") ||
      "(none)",
  );
}

const hit = /--dsa-[a-z0-9-]+/g;
console.log("\n--dsa- names in per-trial prompt:", [
  ...new Set(prompt.match(hit) ?? []),
]);
console.log("--dsa- names in cached context:", [
  ...new Set(shared.match(hit) ?? []),
]);
