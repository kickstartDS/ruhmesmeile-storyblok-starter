#!/usr/bin/env tsx
/**
 * Inspecting a trial.
 *
 *   pnpm report list
 *   pnpm report open  <experiment>/<eval>[/run-N]
 *   pnpm report build <experiment>/<eval>[/run-N] | --all  [--no-screenshots]
 *
 * `open` starts a dev Storybook against one trial; `build` writes a static one
 * into the trial's own directory, which is what publication uploads, and then
 * screenshots the component it produced.
 *
 * Addresses omit the timestamp because there is only ever one current run per
 * experiment × eval (`resolveMatrix` picks it), and typing an ISO timestamp by
 * hand is how you end up inspecting last week's result.
 */

import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAddress, resolveTrials } from "../lib/address";
import {
  listExperiments,
  loadEval,
  resolveMatrix,
  type Trial,
} from "../lib/graders/trial";
import { buildManifest } from "../lib/report/manifest";
import { captureScreenshots } from "../lib/report/screenshot";

const CONFIG_DIR = fileURLToPath(
  new URL("../lib/report/host/.storybook", import.meta.url),
);

/** The manifest is written next to the trial so the Vite plugin can read it. */
function writeManifest(trial: Trial): string {
  const manifest = buildManifest(trial);
  const path = join(trial.runDir, "report-manifest.json");
  writeFileSync(path, JSON.stringify(manifest));
  return path;
}

function runStorybook(
  trial: Trial,
  mode: "dev" | "build",
  port: number,
): Promise<void> {
  const args =
    mode === "dev"
      ? ["storybook", "dev", "-c", CONFIG_DIR, "-p", String(port), "--no-open"]
      : [
          "storybook",
          "build",
          "-c",
          CONFIG_DIR,
          "-o",
          join(trial.runDir, "storybook-static"),
        ];

  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, {
      stdio: "inherit",
      env: { ...process.env, AGENT_EVAL_TRIAL: trial.runDir },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`storybook exited ${code}`)),
    );
  });
}

function list(): void {
  for (const experiment of listExperiments()) {
    const entries = resolveMatrix(experiment);
    if (!entries.length) continue;

    console.log(`\n${experiment}`);
    for (const entry of entries) {
      const trials = loadEval(experiment, entry.timestamp, entry.evalName);
      const runs = trials
        .map((trial) => {
          const built = existsSync(join(trial.runDir, "storybook-static"));
          return `run-${trial.run}${built ? "*" : ""}`;
        })
        .join(" ");
      console.log(`  ${entry.evalName.padEnd(26)} ${runs}`);
    }
  }
  console.log("\n* a static Storybook has already been built for that run.");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const screenshots = !argv.includes("--no-screenshots");
  // `--all` is a flag, and has to be read as one. It was originally matched in
  // the positional slot, which worked right up until `--no-screenshots` made
  // that slot strip anything starting with `--` — after which `build --all`
  // parsed as a build with no address, and failed on the empty string.
  const all = argv.includes("--all");
  const [command, target] = argv.filter((arg) => !arg.startsWith("--"));

  if (!command || command === "list") {
    list();
    return;
  }

  if (command === "open") {
    if (!target) throw new Error("Usage: pnpm report open <experiment>/<eval>");
    const [trial] = resolveTrials(parseAddress(target));
    writeManifest(trial);
    console.log(
      `Serving ${trial.evalName} run-${trial.run} (${trial.variant})`,
    );
    await runStorybook(trial, "dev", 6007);
    return;
  }

  if (command === "build") {
    if (!all && !target) {
      throw new Error(
        "Usage: pnpm report build <experiment>/<eval>[/run-N] | --all",
      );
    }

    const trials = all
      ? listExperiments().flatMap((experiment) =>
          resolveMatrix(experiment).flatMap((entry) =>
            loadEval(experiment, entry.timestamp, entry.evalName),
          ),
        )
      : resolveTrials(parseAddress(target ?? ""));

    console.log(`Building ${trials.length} report Storybook(s)…`);
    const failed: string[] = [];

    for (const [index, trial] of trials.entries()) {
      writeManifest(trial);
      const label = `${trial.experiment} ${trial.evalName} run-${trial.run}`;
      console.log(`\n[${index + 1}/${trials.length}] ${label}`);

      // A trial that will not build is a finding about that trial. Aborting the
      // batch on it throws away the other fifty-nine, and the run has to start
      // over from the beginning — so failures are collected and named at the
      // end instead.
      try {
        await runStorybook(trial, "build", 6007);
      } catch (error) {
        failed.push(`${label} — ${(error as Error).message}`);
        console.log(`  FAILED  ${(error as Error).message}`);
        continue;
      }

      if (!screenshots) continue;
      // A screenshot failure must not cost the built report that produced it:
      // the Storybook is the artifact, the PNG is a convenience for the index.
      try {
        for (const shot of await captureScreenshots(trial.runDir)) {
          console.log(
            `  shot    ${shot.path}${shot.note ? ` — ${shot.note}` : ""}`,
          );
        }
      } catch (error) {
        console.log(`  shot    skipped — ${(error as Error).message}`);
      }
    }

    if (failed.length) {
      console.log(
        `\n${failed.length} of ${trials.length} report(s) failed to build:`,
      );
      for (const line of failed) console.log(`  ${line}`);
      console.log(
        "\nThe index marks these as not built. Rebuild one on its own to see " +
          "the full error.",
      );
      process.exitCode = 1;
    }
    return;
  }

  throw new Error(`Unknown command "${command}". Try list, open or build.`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
