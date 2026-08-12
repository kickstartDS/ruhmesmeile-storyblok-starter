#!/usr/bin/env tsx
/**
 * Bringing hand-grading home.
 *
 *   pnpm labels:pull                     # from the deployed container
 *   pnpm labels:pull --host 1.2.3.4      # somewhere other than $HOSTING_SERVER_IP
 *   pnpm labels:pull --host me@1.2.3.4   # as somebody other than root
 *   pnpm labels:pull --from ~/Downloads  # files saved via "download my labels"
 *   pnpm labels:pull --dry               # say what would change, change nothing
 *
 * `/calibrate` is served from a container whose disk is a deploy away from
 * being replaced. A Docker volume keeps the labels across deploys and that is
 * all it does — it is not a backup, it is not readable by `pnpm judge`, and it
 * is not in the repository. This closes that gap: pull, inspect, commit.
 *
 * The merge is per *label*, not per file. The same person grades on a laptop
 * against a checkout and on a phone against the deployment, so `julrich.json`
 * exists in both places holding different answers, and copying either over the
 * other silently destroys a session's work. Labels are keyed by material hash,
 * so the two maps union cleanly and the only real conflict — the same key
 * answered twice — is settled by `labelledAt`, newest wins.
 *
 * Nothing is ever removed. A key that is local and not remote is a label graded
 * here and not yet pushed anywhere, which is the normal state of this file.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Label } from "../lib/judge/calibration";

const LABEL_DIR = fileURLToPath(
  new URL("../calibration/labels", import.meta.url),
);

/** Where the labels live inside the image. Set by `config/deploy-agent-eval-results.yml`. */
const REMOTE_DIR = "/app/packages/agent-eval/calibration/labels";

/**
 * `head -1` because a deploy briefly runs two containers, and two ids on
 * separate lines make `docker cp` copy from a container called
 * "abc123\ndef456". The trailing `/.` copies the directory's *contents*, and
 * `-` makes it a tar on stdout rather than a path on the remote disk.
 */
const REMOTE_CMD =
  `docker cp "$(docker ps -qf name=agent-eval-results | head -1)":` +
  `${REMOTE_DIR}/. -`;

const argv = process.argv.slice(2);

function flag(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

const readMap = (path: string): Record<string, Label> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, Label>;

/**
 * Stream the remote label directory into a scratch tree.
 *
 * Two processes rather than one `ssh … | tar x` shell string: the host is
 * whatever an operator put in an environment variable, and there is no reason
 * for it to reach a shell as text. The remote half is a constant.
 */
function fetchInto(directory: string): void {
  const host = flag("host") ?? process.env.HOSTING_SERVER_IP;

  if (!host)
    throw new Error(
      "No host. Pass --host <ip>, set HOSTING_SERVER_IP, or use --from <dir> " +
        "to merge files downloaded through the browser.",
    );

  /**
   * `HOSTING_SERVER_IP` is a bare address — it is the same variable the Kamal
   * configs read, and there it is only ever a host. Left bare, `ssh` fills in
   * the local account, which is nobody on that machine. Kamal itself has no
   * `ssh: user:` block, so it deploys as root and the docker socket belongs to
   * root; that is the account this has to arrive as. Still overridable, since
   * `--host you@1.2.3.4` passes straight through.
   */
  const target = host.includes("@") ? host : `root@${host}`;

  let tar: Buffer;

  try {
    tar = execFileSync("ssh", [target, REMOTE_CMD], {
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const detail = String((error as { stderr?: Buffer }).stderr ?? "").trim();
    throw new Error(
      `Could not read ${REMOTE_DIR} on ${target}${detail ? `: ${detail}` : ""}.\n` +
        "The container must be running (kamal details -d agent-eval-results) " +
        "and this machine must be able to ssh to the host.",
    );
  }

  execFileSync("tar", ["x", "-C", directory], { input: tar });
}

/** Every `<rater>.json` in a directory, as [rater, labels]. */
function ratersIn(directory: string): Array<[string, Record<string, Label>]> {
  if (!existsSync(directory)) return [];

  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => [
      file.replace(/\.json$/, ""),
      readMap(join(directory, file)),
    ]);
}

interface Change {
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * Union one rater's incoming labels into their local file.
 *
 * `labelledAt` is an ISO timestamp written by whichever side recorded the
 * verdict, so it compares lexicographically and means the same thing on both.
 */
function merge(
  rater: string,
  incoming: Record<string, Label>,
  dry: boolean,
): Change {
  const path = join(LABEL_DIR, `${rater}.json`);
  const local = existsSync(path) ? readMap(path) : {};
  const change: Change = { added: 0, updated: 0, unchanged: 0 };

  for (const [key, label] of Object.entries(incoming)) {
    const mine = local[key];

    if (!mine) {
      local[key] = label;
      change.added += 1;
    } else if (label.labelledAt > mine.labelledAt) {
      local[key] = label;
      change.updated += 1;
    } else {
      change.unchanged += 1;
    }
  }

  if (!dry && change.added + change.updated > 0) {
    mkdirSync(LABEL_DIR, { recursive: true });
    writeFileSync(path, `${JSON.stringify(local, null, 2)}\n`);
  }

  return change;
}

function main(): void {
  const dry = argv.includes("--dry");
  const from = flag("from");
  const scratch = from
    ? null
    : mkdtempSync(join(tmpdir(), "agent-eval-labels-"));

  try {
    const source = from ? resolve(from) : scratch!;
    if (!from) fetchInto(source);

    const raters = ratersIn(source);

    if (!raters.length) {
      console.log(`No <rater>.json files under ${source}. Nothing to merge.`);
      return;
    }

    let added = 0;
    let updated = 0;

    for (const [rater, incoming] of raters) {
      const change = merge(rater, incoming, dry);
      added += change.added;
      updated += change.updated;

      console.log(
        `  ${rater.padEnd(16)} ${String(change.added).padStart(4)} new  ` +
          `${String(change.updated).padStart(4)} newer  ` +
          `${String(change.unchanged).padStart(4)} already held`,
      );
    }

    console.log(
      `\n${added} added, ${updated} updated across ${raters.length} rater(s) ` +
        `in ${relative(process.cwd(), LABEL_DIR)}.`,
    );

    if (dry) console.log("Dry run — nothing written.");
    else if (added + updated > 0)
      console.log(
        "Review with `git diff` and commit: these are the most expensive " +
          "artefact this project produces.",
      );
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }
}

main();
