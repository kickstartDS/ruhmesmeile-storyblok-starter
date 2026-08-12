/**
 * Hand-grading, for people who do not have the results tree.
 *
 * `bin/calibrate.ts` requires a 113 MB gitignored directory, a pnpm install and
 * a terminal, which is why the project has one rater and 153 unanswered pairs.
 * This serves the same queue from `calibration/bundle.json` — material,
 * criterion, brief, no results tree — so an extra grader needs a URL.
 *
 * **The queue is shared, not duplicated.** An item any rater has answered is
 * gone from everyone's queue, so N people finish in roughly 1/N the sittings.
 * That is the current priority: coverage first, and one human verdict per pair
 * is enough to be getting on with.
 *
 * The thing deliberately given up is the inter-rater ceiling — human/judge
 * agreement is a number whose error bar is unknown until two people have graded
 * the same material, and a rubric humans themselves only agree 70% on is not a
 * rubric the judge is failing. Deferring it is cheap and reversible: labels are
 * permanent and keyed by material hash, so a later overlap campaign only has to
 * serve keys that are already answered — one inverted filter below — and every
 * label collected in the meantime still counts. `raterAgreement()` is already
 * written and reports the moment any overlap exists.
 *
 * Two properties are load-bearing and easy to lose:
 *
 * **The judge's verdict is not here.** It is not withheld by the UI, it is
 * absent from the bundle. A verdict on screen before labelling is an anchor.
 *
 * **A rater is never inferred silently.** Names are attribution rather than
 * measurement now, but they are still the reason two people labelling at once
 * do not fight over one file, and a label whose author is unknown cannot be
 * revisited later. With auth on, the name is the JWT subject. With auth off
 * there is nothing to derive it from, so the app asks.
 *
 * Runs under plain `node` alongside `index.ts`, so it imports nothing from
 * `lib/` — the image does not contain it. The write side is a few lines of
 * `fs`; all the pooling, consensus and agreement maths stays in `lib/judge`,
 * which reads these files back.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isAuthEnabled, verifyToken } from "@kickstartds/shared-auth";
import type { Express, Request, Response } from "express";

const CALIBRATION_DIR =
  process.env.CALIBRATION_DIR ??
  join(dirname(fileURLToPath(import.meta.url)), "..", "calibration");

const BUNDLE = join(CALIBRATION_DIR, "bundle.json");
const REASONS = join(CALIBRATION_DIR, "reasons.json");
const LABEL_DIR = join(CALIBRATION_DIR, "labels");

// Where a reset puts things instead of deleting them.
//
// Inside `LABEL_DIR` deliberately, so it sits on the same volume and leaves
// with the same `labels:pull`. Safe there because both readers of that
// directory — `answered()` below and `readRaters()` in `lib/judge` — list one
// level and keep only names ending `.json`, so a subdirectory is invisible to
// both. A retired file kept as a sibling would still be pooled and would go on
// answering the queue, which is the one thing a reset is for.
const RETIRED_DIR = join(LABEL_DIR, "retired");

// The labels graded before the store was split per rater. Reading it matters:
// without it the host re-asks 23 questions that already have an answer.
const LEGACY = join(CALIBRATION_DIR, "labels.json");
const COOKIE = "auth_token";

interface BundleItem {
  key: string;
  rubric: string;
  evalName: string;
  variant: string;
  address: string;
  material: string;
  brief?: string;
}

interface Bundle {
  generatedAt: string;
  items: BundleItem[];
  rubrics: Array<{ id: string; label: string; criterion: string }>;
  /** Judge's cached system block per rubric. Absent in pre-D-127 bundles. */
  context?: Record<string, string>;
}

interface Reason {
  id: string;
  label: string;
  rubrics: string[];
}

interface Label {
  verdict: "pass" | "fail" | "unknown";
  /** Ids from `reasons.json`. The sentence is looked up, never stored. */
  reasons: string[];
  /** Whatever the pick list had no entry for. */
  note: string;
  address: string;
  rubric: string;
  labelledAt: string;
  rater: string;
}

/**
 * A rater name is concatenated into a path, so this is the only thing standing
 * between a JWT subject and `../../server/index.ts`. Allow-list, not a
 * blocklist, and no dots at all — there is no legitimate rater called `..`.
 */
const RATER = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

const readBundle = (): Bundle =>
  JSON.parse(readFileSync(BUNDLE, "utf8")) as Bundle;

/**
 * The pick list, read per request rather than baked into the bundle.
 *
 * It used to ride along in `bundle.json`, which meant rewording one sentence
 * required regenerating a megabyte of material on the machine that still has
 * `results/`. Read from disk instead and the dictionary is deployable on its
 * own: edit, deploy, done. It is a few hundred bytes and this route is hit
 * once per grade by one person, so caching it would only buy a stale list.
 */
const readReasons = (): Reason[] =>
  JSON.parse(readFileSync(REASONS, "utf8")) as Reason[];

const labelPath = (rater: string): string => join(LABEL_DIR, `${rater}.json`);

const readJson = (path: string): Record<string, Label> =>
  existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, Label>)
    : {};

const readLabels = (rater: string): Record<string, Label> =>
  readJson(labelPath(rater));

/**
 * Every key anyone has answered, across the legacy store and all per-rater
 * files. Keys are material hashes, so this survives raters coming and going and
 * does not care who answered what — only that somebody did.
 */
function answered(): Set<string> {
  const keys = new Set(Object.keys(readJson(LEGACY)));

  if (existsSync(LABEL_DIR))
    for (const file of readdirSync(LABEL_DIR))
      if (file.endsWith(".json"))
        for (const key of Object.keys(readJson(join(LABEL_DIR, file))))
          keys.add(key);

  return keys;
}

/**
 * Who is asking.
 *
 * The JWT subject when the gate is up — it is already verified, already unique,
 * and it means nobody types their own name into an attribution. `?rater=` is
 * the unauthenticated fallback and is exactly as trustworthy as the open site
 * it belongs to.
 */
function raterOf(request: Request): string | null {
  if (isAuthEnabled()) {
    const cookies = (request as Request & { cookies?: Record<string, string> })
      .cookies;
    const user = cookies?.[COOKIE] ? verifyToken(cookies[COOKIE]) : null;
    const name = user?.sub ?? "";
    return RATER.test(name) ? name : null;
  }

  const asked = String(request.query.rater ?? "").trim();
  return RATER.test(asked) ? asked : null;
}

export function mountCalibration(app: Express): void {
  if (!existsSync(BUNDLE)) {
    console.log(
      "calibration: no bundle.json — /calibrate disabled." +
        " Run `pnpm --filter agent-eval calibration:export`.",
    );
    return;
  }

  app.get("/calibrate", (_request, response) => {
    response.type("html").send(PAGE);
  });

  /**
   * The queue, minus what anyone has answered — the same rule `bin/calibrate.ts`
   * has always applied, so the terminal and the browser now agree about what is
   * left. The bundle order is preserved, which keeps the grid evenly covered
   * whenever people stop, and means two raters working at once take disjoint
   * slices off the front rather than racing down the same one.
   */
  app.get("/calibrate/api/session", (request, response) => {
    const rater = raterOf(request);
    if (!rater) {
      response.status(401).json({ error: "no rater", authed: isAuthEnabled() });
      return;
    }

    const bundle = readBundle();
    const taken = answered();
    const live = new Set(bundle.items.map((item) => item.key));
    const pending = bundle.items.filter((item) => !taken.has(item.key));
    const item = pending[0] ?? null;

    response.json({
      rater,
      generatedAt: bundle.generatedAt,
      total: bundle.items.length,
      done: bundle.items.length - pending.length,
      // Intersected with the bundle, exactly as `done` is. A label is keyed by
      // a hash of the material, so widening what the judge is shown orphans
      // every label formed against the narrower version: the pair correctly
      // returns to the queue, and the answer stays in the rater's file as a
      // record of work that no longer answers anything. Counting the file
      // instead reports those orphans back to the person who wrote them, on
      // the same line as a `done` that has already dropped them — two numbers
      // side by side under different rules, and the wrong one is the one with
      // their name on it (D-131).
      mine: Object.keys(readLabels(rater)).filter((key) => live.has(key))
        .length,
      rubrics: bundle.rubrics,
      reasons: readReasons(),
      item,
      // Only the current rubric's block. The map holds every rubric's and the
      // token list alone is 54 KB, which is not worth sending three times over
      // to a phone for the two thirds of it that will not be rendered.
      context: (item && bundle.context?.[item.rubric]) ?? null,
      remaining: pending.length,
    });
  });

  app.post("/calibrate/api/label", (request, response) => {
    const rater = raterOf(request);
    if (!rater) {
      response.status(401).json({ error: "no rater" });
      return;
    }

    const body = request.body as {
      key?: string;
      verdict?: string;
      reasons?: unknown;
      note?: string;
    };
    const verdict = body.verdict;

    if (verdict !== "pass" && verdict !== "fail" && verdict !== "unknown") {
      response.status(400).json({ error: "bad verdict" });
      return;
    }

    const item = readBundle().items.find((entry) => entry.key === body.key);
    if (!item) {
      response.status(404).json({ error: "unknown key" });
      return;
    }

    /*
     * Filtered against the dictionary, and against this rubric's slice of it.
     *
     * An id is now the whole content of a diagnosis, so an unrecognised one is
     * not a typo in a sentence — it is a label that will read as nothing at all
     * once the sentence is looked up. Dropping it here keeps that failure in
     * the request, where it is a bug, rather than in the store, where it is a
     * lost afternoon. The rubric scope is enforced for the same reason it is
     * applied when rendering the list: it is the only thing stopping a
     * design-intent verdict from being explained in code-idiom vocabulary.
     */
    const offered = new Set(
      readReasons()
        .filter((reason) => reason.rubrics.includes(item.rubric))
        .map((reason) => reason.id),
    );
    const reasons = (
      Array.isArray(body.reasons) ? (body.reasons as unknown[]) : []
    )
      .filter((id): id is string => typeof id === "string" && offered.has(id))
      .slice(0, 32);

    // Not rejected if someone else answered it first. Two people can be holding
    // the same item when one of them submits, and discarding a verdict that has
    // already been reasoned about is worse than storing it — a second opinion on
    // one pair is the overlap the ceiling will eventually want.
    const labels = readLabels(rater);
    labels[item.key] = {
      verdict,
      reasons,
      note: String(body.note ?? "").slice(0, 2000),
      address: item.address,
      rubric: item.rubric,
      labelledAt: new Date().toISOString(),
      rater,
    };

    mkdirSync(LABEL_DIR, { recursive: true });
    writeFileSync(labelPath(rater), `${JSON.stringify(labels, null, 2)}\n`);

    response.json({ ok: true, done: Object.keys(labels).length });
  });

  /**
   * Take the work home.
   *
   * The container's disk is a deploy away from being replaced, and the labels
   * belong in the repository next to the ones graded on a laptop. This is the
   * hand-off: download, drop into `calibration/labels/`, commit.
   */
  app.get("/calibrate/api/export", (request, response) => {
    const rater = raterOf(request);
    if (!rater) {
      response.status(401).json({ error: "no rater" });
      return;
    }

    response
      .type("json")
      .setHeader("Content-Disposition", `attachment; filename="${rater}.json"`);
    response.send(`${JSON.stringify(readLabels(rater), null, 2)}\n`);
  });

  /**
   * Start over.
   *
   * The volume outlives the image on purpose, which is what makes labels worth
   * writing through a browser at all — but it also means the only way to undo a
   * sitting was `ssh` and `rm`, and the people this app exists for are exactly
   * the ones without that. So: a route.
   *
   * Three things keep a destructive verb honest on a site that runs open
   * whenever `MCP_JWT_SECRET` is unset.
   *
   * **It is archived, never deleted.** Hand-grading is the most expensive data
   * in the project per byte — it is somebody's afternoon, and unlike the
   * results tree it cannot be regenerated at any price. `retired/` costs
   * nothing and is the difference between a mistake and a loss. It is also
   * what was done by hand when the first labels were retired (D-126).
   *
   * **It is yours only.** The same scope as writing: `raterOf()` picks the
   * file, and other raters and the legacy store are unreachable from here. The
   * queue is shared, so one person's reset would otherwise resurrect
   * everybody's work.
   *
   * **It asks you to type your name.** Not ceremony — `scope: "all"` on a bare
   * POST is one stray fetch away from an empty file, and a confirmation the
   * caller cannot supply by accident is the cheapest guard that actually holds.
   *
   * `scope` is the part worth reading twice. `"orphans"` drops only labels with
   * no matching pair in the current bundle — the residue of the material under
   * them changing, as when a rubric starts being shown a file it was not shown
   * before (D-129). Those are already inert: `agreement()` reaches labels
   * through candidates, so an orphan is unreachable rather than miscounted, and
   * since D-131 it is not miscounted on screen either. Clearing them is tidying
   * rather than repair, and it is not wired to the UI for that reason. `"all"`
   * is the real reset, for a sitting graded against the wrong reading of a
   * criterion.
   */
  app.post("/calibrate/api/reset", (request, response) => {
    const rater = raterOf(request);
    if (!rater) {
      response.status(401).json({ error: "no rater" });
      return;
    }

    const body = request.body as { scope?: string; confirm?: string };
    const scope = body.scope;

    if (scope !== "orphans" && scope !== "all") {
      response.status(400).json({ error: "scope must be 'orphans' or 'all'" });
      return;
    }

    if (body.confirm !== rater) {
      response.status(400).json({ error: "confirm must be the rater name" });
      return;
    }

    const labels = readLabels(rater);
    const live = new Set(readBundle().items.map((item) => item.key));
    const dropped = Object.keys(labels).filter(
      (key) => scope === "all" || !live.has(key),
    );

    if (!dropped.length) {
      response.json({
        removed: 0,
        kept: Object.keys(labels).length,
        archive: null,
      });
      return;
    }

    // Colons out: this is a filename, and it wants to sort lexically as well as
    // chronologically.
    const name = `${rater}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    mkdirSync(RETIRED_DIR, { recursive: true });
    writeFileSync(
      join(RETIRED_DIR, name),
      `${JSON.stringify(
        Object.fromEntries(dropped.map((key) => [key, labels[key]])),
        null,
        2,
      )}\n`,
    );

    // Only once the copy is on disk. The order is the entire safety property.
    for (const key of dropped) delete labels[key];
    writeFileSync(labelPath(rater), `${JSON.stringify(labels, null, 2)}\n`);

    response.json({
      removed: dropped.length,
      kept: Object.keys(labels).length,
      archive: `retired/${name}`,
    });
  });
}

/**
 * One file, no build step, no framework — the same bet `index.ts` makes about
 * its login page. Everything untrusted arrives as JSON and is placed with
 * `textContent`: the material is agent-authored HTML and JavaScript, and it is
 * being shown to a reviewer on an origin that holds their session cookie.
 *
 * Which is the whole difficulty with syntax highlighting, because highlighting
 * is the one feature whose obvious implementation is "turn this string into
 * markup". The lexer below therefore emits *nodes* — `span.textContent` and
 * text nodes, never `innerHTML` — so colour is added without the string ever
 * being parsed as HTML. Highlighting a hostile file is then a cosmetic
 * question rather than a security one.
 *
 * `String.raw` because the page is a template literal containing regular
 * expressions: without it every backslash would be eaten on the way out, and a
 * comment rule written as backslash-slash-backslash-slash would reach the
 * browser as three bare slashes — a syntax error rather than a wrong colour.
 * Under `String.raw` what is written here is what the browser parses. The cost
 * is that a literal backtick can no longer be escaped, so the one rule that
 * needs one — template strings — spells it `\x60`.
 */
const PAGE = String.raw`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>calibration</title>
<style>
  :root {
    color-scheme: light dark;
    --line: rgba(128,128,128,.35);
    /* Height of the sticky header and of the fixed dock, for anything that has
       to sit between them. Measured, not guessed — see setChrome(). */
    --head: 3.2rem;
    --dock: 3.6rem;
    --com: #6a737d; --str: #0a7d3f; --key: #b31d8f; --tag: #1a56db;
    --num: #b45309; --tok: #7c3aed; --at: #a21caf; --sel: #1a56db; --fn: #0369a1;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --com: #8b949e; --str: #7ee787; --key: #ff7b72; --tag: #79c0ff;
      --num: #ffa657; --tok: #d2a8ff; --at: #ff7b72; --sel: #79c0ff; --fn: #79c0ff;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.6 ui-sans-serif, system-ui, sans-serif; }
  header { position: sticky; top: 0; display: flex; gap: .3rem 1rem; align-items: baseline;
           padding: .7rem 1.2rem; border-bottom: 1px solid var(--line);
           background: Canvas; z-index: 4; flex-wrap: wrap; }
  header b { font-weight: 600; }
  header span { opacity: .65; font-size: .85em; }
  header a { margin-left: auto; font-size: .85em; }
  dialog { max-width: 32rem; border: 1px solid var(--line); border-radius: 10px;
           padding: 1.2rem; background: Canvas; color: CanvasText; }
  dialog::backdrop { background: rgba(0,0,0,.5); }
  dialog p { font-size: .9em; opacity: .8; }
  dialog menu { display: flex; gap: .6rem; justify-content: flex-end;
                margin: 1rem 0 0; padding: 0; }
  main { max-width: 62rem; margin: 0 auto; padding: 1.2rem 1.2rem 6rem; }
  h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .07em;
       opacity: .6; margin: 1.6rem 0 .4rem; }
  pre { font: 12.5px/1.55 ui-monospace, monospace; white-space: pre-wrap;
        word-break: break-word; background: rgba(128,128,128,.09);
        padding: .8rem; border-radius: 7px; margin: 0; }
  .crit { background: rgba(128,128,128,.06); border-left: 3px solid var(--line);
          padding: .6rem .9rem; border-radius: 0 6px 6px 0; white-space: pre-wrap; }
  .brief { border-left-color: #2563eb; }
  /* The rubric id, not its label. The label is a sentence and reads as part of
     the heading; the id is the word the checklist, the ADRs and reasons.json
     all use, and a grader picking a diagnosis scoped to design-intent should be
     able to see that word on the page they are picking it from. */
  .tag { font: 600 .72rem/1 ui-monospace, monospace; text-transform: none;
         letter-spacing: 0; opacity: 1; padding: .3em .5em; border-radius: 5px;
         background: rgba(128,128,128,.16); cursor: help; margin-right: .5rem;
         vertical-align: .05em; }
  textarea { width: 100%; font: inherit; padding: .5rem; border-radius: 6px;
             border: 1px solid var(--line); background: Canvas; color: inherit; }
  button { font: inherit; padding: .55rem 1rem; border-radius: 7px; cursor: pointer;
           border: 1px solid var(--line); background: Canvas; color: inherit; }
  button.pass { border-color: #16a34a; }
  button.fail { border-color: #dc2626; }
  button kbd { opacity: .55; font: inherit; }
  #done { display: none; padding: 3rem 0; text-align: center; }

  /* Syntax. One class per rule in GRAMMARS; unmatched text stays inherited. */
  .hd { display: block; margin: .9rem 0 .3rem; font-weight: 600; opacity: .75; }
  .hd:first-child { margin-top: 0; }
  .com { color: var(--com); font-style: italic; }
  .str { color: var(--str); }
  .key { color: var(--key); }
  .tag { color: var(--tag); }
  .num { color: var(--num); }
  .tok { color: var(--tok); font-weight: 600; }
  .at  { color: var(--at); }
  .sel { color: var(--sel); }
  .fn  { color: var(--fn); }

  /* The flyout. Long material means the controls cannot live at the end of it:
     a diagnosis is noticed while reading line 200, and having to scroll to the
     bottom to record it is how it gets forgotten instead. */
  .dock { position: fixed; inset: auto 0 0 0; background: Canvas; z-index: 3;
          border-top: 1px solid var(--line); }
  .dock > div { max-width: 62rem; margin: 0 auto; padding: .6rem 1.2rem;
                display: flex; gap: .5rem; }
  .dock button { flex: 1 1 0; white-space: nowrap; }
  #toggle { flex: 2 1 0; }
  #toggle[aria-expanded="true"] { background: rgba(128,128,128,.16); }
  #count { font-variant-numeric: tabular-nums; }
  .panel { position: fixed; inset: auto 0 0 0; z-index: 2; background: Canvas;
           border-top: 1px solid var(--line); max-height: 62vh; overflow: auto;
           box-shadow: 0 -14px 34px rgba(0,0,0,.22); }
  .panel > div { max-width: 62rem; margin: 0 auto; padding: .2rem 1.2rem 4.6rem; }
  .panel h2 { margin-top: 1rem; }
  .reasons label { display: flex; gap: .55rem; align-items: baseline;
                   padding: .3rem 0; cursor: pointer; border-radius: 5px; }
  .reasons b { opacity: .45; font: 600 .8em ui-monospace, monospace; min-width: 1.2em; }
  /* The row a half-typed number is currently pointing at. Without it "1" is
     indistinguishable from a dropped keystroke for the length of the wait. */
  .reasons label.pending { background: rgba(128,128,128,.22);
                           box-shadow: 0 0 0 .35rem rgba(128,128,128,.22); }
  .reasons label.pending b { opacity: 1; }
  .panel h2 .hint { font-weight: 400; font-size: .78rem; opacity: .5; }
  .asking { position: sticky; top: 0; background: Canvas; z-index: 1;
            padding: .6rem 0 .5rem; border-bottom: 1px solid var(--line);
            font-size: .85rem; }
  .asking b { font-weight: 600; }
  p.hint { font-size: .85rem; opacity: .6; margin: .4rem 0 0; }

  #refWrap { margin-top: 1.6rem; }
  summary { cursor: pointer; font-size: .8rem; text-transform: uppercase;
            letter-spacing: .07em; opacity: .6; padding: .3rem 0; }
  summary:hover { opacity: .9; }
  #ref[open] summary { margin-bottom: .4rem; }

  /* Two columns once there is room for two readable ones. Everything on the
     left is the question — criterion, brief, the references it tells you to
     compare against — and the right is the thing being answered about. On one
     column those alternate down the page, so holding a reference next to the
     line of material that prompted it is a scroll each way.

     The left column sticks: material is routinely ten times longer, so a
     column that scrolled with it would leave the question off screen for most
     of the reading, which is the D-126 failure with extra steps. */
  @media (min-width: 1500px) {
    main { max-width: 116rem; }
    #card { display: grid; align-items: start; gap: 0 2.2rem;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); }
    /* Sized for its unstuck position, which is the binding one: the column is
       one main-padding below the header at scroll 0 and flush with it after,
       so anything taller sits behind the dock on first paint — opaque, and
       therefore indistinguishable from missing. */
    #context { position: sticky; top: var(--head); overflow: auto;
               max-height: calc(100vh - var(--head) - var(--dock) - 2.6rem);
               padding-right: .4rem; }
    #context > h2:first-child, #evidence > h2:first-child { margin-top: 0; }
  }

  @media (max-width: 640px) {
    body { font-size: 14px; }
    header { padding: .55rem .8rem; }
    header a { margin-left: 0; }
    main { padding: .8rem .8rem 6rem; }
    pre { font-size: 11.5px; padding: .6rem; }
    .dock > div, .panel > div { padding-left: .8rem; padding-right: .8rem; }
    .dock button { padding: .55rem .4rem; }
    .dock kbd { display: none; }
    /* Thirteen two-line rows do not fit a phone, and the note sits under all
       of them — so buy back the height rather than make it a longer scroll. */
    .panel { max-height: 74vh; }
    .panel h2 { margin-top: .7rem; }
    .reasons label { font-size: 13px; line-height: 1.4; padding: .25rem 0; }
  }
</style>

<header>
  <b>calibration</b>
  <span id="who"></span>
  <span id="progress"></span>
  <span id="flash"></span>
  <!-- href set in load(), because it needs the same rater query every fetch on
       this page carries and a static attribute cannot have one. Hidden until
       then: without a rater the server has nothing to export and answers 401,
       and a link that is only ever wrong is worse than no link. -->
  <a id="export" download hidden>download my labels</a>
  <!-- Offered after the download, and in that order on purpose: the file the
       rater already has is the only recovery they can perform themselves. -->
  <a id="reset" href="#" onclick="resetLabels(event)" hidden>reset mine</a>
</header>

<!--
  A real <dialog> and not prompt(), which was the first attempt: prompt() is
  simply absent in some embedded and automated contexts, and a confirmation
  step that silently throws where it is not implemented is the wrong failure
  mode for the one control on this page that destroys work.

  method="dialog" is doing something load-bearing. Enter anywhere in the form
  submits the *first* button, which is Cancel, and Escape closes with no value
  at all — so both of the reflexes a grader has built up over an hour of
  keyboard shortcuts resolve to "no". "Reset" is reachable only by aiming at it.
-->
<dialog id="resetBox" onclose="resetClosed()">
  <form method="dialog">
    <h2>Reset your labels</h2>
    <p>Everything you have graded here is archived on the server and stops
       counting, and every pair you answered comes back into the queue. If you
       have not downloaded yours, do that first.</p>
    <input id="resetName" placeholder="type your rater name to confirm"
           autocomplete="off" style="font:inherit;padding:.5rem;width:100%">
    <menu>
      <button value="cancel">Cancel</button>
      <button value="go">Reset</button>
    </menu>
  </form>
</dialog>

<main>
  <div id="gate" hidden>
    <h2>Who is grading?</h2>
    <p>Labels are attributed, and two people sharing a name reads as agreement.</p>
    <input id="name" placeholder="your-name" style="font:inherit;padding:.5rem">
    <button onclick="setName()">Start</button>
  </div>

  <div id="card" hidden>
    <div id="context">
      <h2><span class="tag" id="rubricTag"></span><span id="task"></span></h2>
      <div class="crit" id="criterion"></div>

      <div id="briefWrap" hidden>
        <h2>The brief the author was given</h2>
        <div class="crit brief" id="brief"></div>
      </div>

      <!-- Collapsed on purpose, and not hidden on purpose. Open by default it
           is four hundred lines of button and breadcrumb before the verdict on
           every single pair; absent, it is an exhibit the criterion names and
           the reader cannot see. The open state survives the next item, so
           someone who wants it up keeps it up. -->
      <div id="refWrap" hidden>
        <details id="ref" ontoggle="refOpen = this.open">
          <summary id="refSummary"></summary>
          <pre id="refBody"></pre>
        </details>
      </div>
    </div>

    <div id="evidence">
      <h2>Material</h2>
      <pre id="material"></pre>
    </div>
  </div>

  <div id="done"><h2>Queue empty</h2><p>Every pair in this bundle has a label.</p></div>
</main>

<div class="panel" id="panel" hidden>
  <div>
    <!-- The question, repeated here on purpose. It is stated once at the top of
         the page and then scrolls away behind hundreds of lines of material,
         which is how a verdict ends up answering whichever question the reader
         still remembers. Every design-intent label collected before this was
         a code-idiom label. -->
    <div class="asking"><span class="tag" id="askingTag"></span><b id="asking"></b></div>
    <h2>Common diagnoses <span class="hint">number keys tick a row</span></h2>
    <div class="reasons" id="reasons" onchange="countPicked()"></div>
    <p class="hint" id="noReasons" hidden>
      Nothing canned for this rubric yet — the list is transcribed from what
      graders write, so this one earns its entries from the note below.
    </p>
    <h2>Note</h2>
    <textarea id="note" rows="3" placeholder="anything specific to this one"></textarea>
  </div>
</div>

<div class="dock" id="dock" hidden>
  <div>
    <button id="toggle" onclick="togglePanel()" aria-expanded="false">
      Diagnoses <span id="count"></span> <kbd>d</kbd>
    </button>
    <button class="pass" onclick="send('pass')">Pass <kbd>p</kbd></button>
    <button class="fail" onclick="send('fail')">Fail <kbd>f</kbd></button>
    <button onclick="send('unknown')">Unknown <kbd>u</kbd></button>
  </div>
</div>

<script>
  let state = null;
  let rater = new URLSearchParams(location.search).get("rater") || "";
  /* Whether the reference block is expanded. Survives the next item so that
     opening it is a decision made once, not once per pair. */
  let refOpen = false;

  const $ = (id) => document.getElementById(id);
  const url = (path) => path + (rater ? (path.includes("?") ? "&" : "?") + "rater=" + encodeURIComponent(rater) : "");

  /* --- highlighting ---------------------------------------------------
     Small on purpose. A wrong colour is a cosmetic defect, so the rules
     below are the cheap 90% and none of them try to parse anything: a
     nested capturing group would silently misalign the match-to-class
     mapping in tokenize(), which is why every group here is (?:). */

  const KEYWORDS = "import|export|from|as|const|let|var|function|return|if|else|for|of|in|while|switch|case|break|continue|new|class|extends|implements|interface|type|enum|typeof|instanceof|await|async|try|catch|finally|throw|default|public|private|protected|readonly|static|null|undefined|true|false|this|super|void|satisfies|keyof";

  const GRAMMARS = {
    code: [
      ["com", /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
      ["str", /\x60(?:[^\x60\\]|\\.)*\x60|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/],
      ["tag", /<\/?[A-Z][\w.]*|<\/?[a-z][\w-]*(?=[\s/>])/],
      ["key", new RegExp("\\b(?:" + KEYWORDS + ")\\b")],
      ["fn", /[A-Za-z_$][\w$]*(?=\()/],
      ["num", /\b\d[\w.]*/],
    ],
    scss: [
      ["com", /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
      ["str", /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/],
      ["tok", /--[\w-]+/],
      ["at", /@[\w-]+|\$[\w-]+/],
      ["sel", /[.&#][\w-]+|::?[a-z-]+\b(?!\s*:)/],
      ["fn", /[a-z-]+(?=\()/],
      ["key", /[a-z-]+(?=\s*:)/],
      ["num", /\b\d[\d.]*(?:px|rem|em|%|vh|vw|ms|s|deg|fr)?/],
    ],
    json: [
      ["key", /"(?:[^"\\]|\\.)*"(?=\s*:)/],
      ["str", /"(?:[^"\\]|\\.)*"/],
      ["at", /\b(?:true|false|null)\b/],
      ["num", /-?\b\d[\d.eE+-]*/],
    ],
    md: [
      ["str", /\x60\x60\x60[\s\S]*?\x60\x60\x60|\x60[^\x60\n]*\x60/],
      ["key", /^#{1,6} .*/],
      ["at", /^\s*(?:[-*+]|\d+\.) /],
    ],
    plain: [],
  };

  const langOf = (header) =>
    /\.s?css\b/.test(header) ? "scss"
      : /\.json\b/.test(header) ? "json"
      : /\.md\b/.test(header) ? "md"
      : /\.[cm]?[jt]sx?\b/.test(header) ? "code"
      : "plain";

  /* Any line that names a file, and so switches the grammar. Two markers,
     because two things emit them: judgedMaterial() separates files with
     "===== path =====", and referenceCorpus() separates the exemplars it
     concatenates with "----- slug/file -----". Only the first was known here,
     so the reference block arrived as one unlexed plain slab (D-127). */
  const HEADER = /^(?:=====|-----) .+ (?:=====|-----)$/;

  /* Nodes, not markup — see the comment on PAGE. */
  function el(cls, text) {
    const node = document.createElement("span");
    node.className = cls;
    node.textContent = text;
    return node;
  }

  function tokenize(text, lang) {
    const rules = GRAMMARS[lang] || [];
    const frag = document.createDocumentFragment();

    if (!rules.length) { frag.append(text); return frag; }

    const re = new RegExp(rules.map((rule) => "(" + rule[1].source + ")").join("|"), "gm");
    let last = 0;
    let match;

    while ((match = re.exec(text))) {
      if (match[0] === "") { re.lastIndex += 1; continue; }
      if (match.index > last) frag.append(text.slice(last, match.index));
      frag.append(el(rules[match.slice(1).findIndex((v) => v !== undefined)][0], match[0]));
      last = re.lastIndex;
    }

    if (last < text.length) frag.append(text.slice(last));
    return frag;
  }

  /* Material is judgedMaterial() output: a header line, then the file.
     The header names the language, so each section is lexed as what it is. */
  function renderMaterial(text) {
    const frag = document.createDocumentFragment();
    let lang = "plain";

    for (const part of text.split(new RegExp("(" + HEADER.source + ")", "m"))) {
      if (!part) continue;
      if (HEADER.test(part)) {
        lang = langOf(part);
        frag.append(el("hd", part));
      } else {
        frag.append(tokenize(part, lang));
      }
    }

    return frag;
  }

  /* --- flyout --------------------------------------------------------- */

  /* Digits tick rows, and with thirteen of them a keystroke cannot be acted
     on the instant it arrives: "1" is both a diagnosis and the first half of
     "12". So digits land in a buffer that flushes on a timer.

     The timer only runs when it has to. Most first digits cannot begin a
     longer number — at thirteen entries only "1" can — so everything else
     commits immediately and the wait is the exception, not the rule. */
  const DIGIT_WAIT = 450;
  let buffer = "";
  let timer = 0;

  function togglePanel(force) {
    const panel = $("panel");
    const open = force === undefined ? panel.hidden : force;
    panel.hidden = !open;
    $("toggle").setAttribute("aria-expanded", String(open));
    if (!open) clearDigits();
  }

  function countPicked() {
    const picked = document.querySelectorAll(".reason:checked").length;
    $("count").textContent = picked ? "(" + picked + ")" : "";
  }

  const pendingRow = () => (buffer ? $("reasons").children[Number(buffer) - 1] : null);

  function markPending() {
    for (const row of $("reasons").children) row.classList.remove("pending");
    const row = pendingRow();
    if (!row) return;
    row.classList.add("pending");
    // The panel is 62vh of scroll; row 13 can easily be below its fold.
    row.scrollIntoView({ block: "nearest" });
  }

  function clearDigits() {
    clearTimeout(timer);
    timer = 0;
    buffer = "";
    markPending();
  }

  function commitDigits() {
    const row = pendingRow();
    clearDigits();
    if (!row) return;
    const box = row.querySelector(".reason");
    box.checked = !box.checked;
    countPicked();
  }

  function typeDigit(digit) {
    // The offered list, not the full one — it is scoped per rubric, so the
    // highest valid number changes with the question.
    const count = $("reasons").children.length;
    const next = buffer + digit;

    if (Number(next) >= 1 && Number(next) <= count) {
      clearTimeout(timer);
      buffer = next;
    } else {
      // Out of range. Read it as the start of a new number rather than
      // swallowing it — someone typing 12 then 3 means 3, not nothing.
      clearDigits();
      if (Number(digit) < 1 || Number(digit) > count) return;
      buffer = digit;
    }

    markPending();

    const extendable = [...Array(count).keys()].some((index) => {
      const number = String(index + 1);
      return number.length > buffer.length && number.startsWith(buffer);
    });

    if (extendable) timer = setTimeout(commitDigits, DIGIT_WAIT);
    else commitDigits();
  }

  /* --- session -------------------------------------------------------- */

  async function load() {
    const response = await fetch(url("/calibrate/api/session"));

    if (response.status === 401) {
      const body = await response.json();
      if (body.authed) { location.href = "/login"; return; }
      $("gate").hidden = false;
      return;
    }

    state = await response.json();
    $("gate").hidden = true;
    $("who").textContent = state.rater;
    $("progress").textContent = state.done + " of " + state.total + " graded · " + state.mine + " by you";
    $("flash").textContent = "";

    /* The one request on this page the browser makes without going through
       fetch(), so it is the one that has to be told who is asking. When the
       gate is up the rater comes from the query string, and a bare href
       arrives without it and is refused. */
    $("export").href = url("/calibrate/api/export");
    $("export").hidden = false;
    $("reset").hidden = false;

    togglePanel(false);

    if (!state.item) {
      $("card").hidden = true;
      $("dock").hidden = true;
      $("done").style.display = "block";
      return;
    }

    const item = state.item;
    const rubric = state.rubrics.find((entry) => entry.id === item.rubric);

    $("card").hidden = false;
    $("dock").hidden = false;
    $("task").textContent = item.evalName + " — " + rubric.label;
    $("criterion").textContent = rubric.criterion;

    // Every criterion opens with the one-line version of itself, so the hover
    // text is the first line of the thing already printed underneath rather
    // than a second description that can drift away from it.
    const gist = rubric.criterion.split("\n\n")[0].replace(/\s+/g, " ").trim();
    for (const id of ["rubricTag", "askingTag"]) {
      $(id).textContent = rubric.id;
      $(id).title = gist;
    }

    $("briefWrap").hidden = !item.brief;
    $("brief").textContent = item.brief || "";

    // textContent, always: this string is code an agent wrote.
    $("material").replaceChildren(renderMaterial(item.material));

    // What the judge was handed on top of the material. The criterion for two
    // of the three rubrics says outright to compare against these, so a grader
    // without them is answering a different question than the judge did.
    $("refWrap").hidden = !state.context;
    if (state.context) {
      const titles = [...state.context.matchAll(/^===== (.+) =====$/gm)].map((m) => m[1]);
      $("refSummary").textContent = "Also shown to the judge — " + titles.join("; ");
      $("ref").open = refOpen;
      $("refBody").replaceChildren(renderMaterial(state.context));
    }

    // Numbered to match the CLI, so a diagnosis can be discussed by number.
    // Scoped to the rubric: a diagnosis the question does not ask about will
    // get picked if it is offered, and the label then measures another rubric.
    const offered = state.reasons.filter((reason) => reason.rubrics.includes(item.rubric));
    $("noReasons").hidden = offered.length > 0;
    $("asking").textContent = rubric.label;

    $("reasons").replaceChildren(...offered.map((reason, index) => {
      const line = document.createElement("label");
      const box = document.createElement("input");
      const num = document.createElement("b");
      box.type = "checkbox";
      box.value = reason.id;
      box.className = "reason";
      num.textContent = index + 1;
      line.append(box, num, document.createTextNode(reason.label));
      return line;
    }));

    $("note").value = "";
    countPicked();
    scrollTo(0, 0);
    // The header only reaches its real height once it has a name and a count
    // in it, and the sticky column is positioned from that.
    setChrome();
  }

  function setName() {
    const value = $("name").value.trim();
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) return;
    rater = value;
    history.replaceState(null, "", "?rater=" + encodeURIComponent(rater));
    load();
  }

  async function send(verdict) {
    if (!state || !state.item) return;

    const reasons = [...document.querySelectorAll(".reason:checked")].map((box) => box.value);
    const note = $("note").value.trim();

    await fetch(url("/calibrate/api/label"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: state.item.key, verdict, reasons, note }),
    });

    load();
  }

  /* prompt() lived here first and is not universally implemented, so the
     confirmation is a <dialog> in the markup instead. The name is checked by
     the server rather than here: one rule, in the place that enforces it. */
  function resetLabels(event) {
    event.preventDefault();
    if (!state) return;

    // returnValue survives the previous open. Left alone, an Escape after an
    // earlier confirmed reset would count as a second one.
    $("resetBox").returnValue = "";
    $("resetName").value = "";
    $("resetBox").showModal();
  }

  async function resetClosed() {
    if ($("resetBox").returnValue !== "go") return;

    const response = await fetch(url("/calibrate/api/reset"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "all", confirm: $("resetName").value.trim() }),
    });

    const body = await response.json();

    // Reload first — the queue has grown by whatever came back — then report,
    // because load() clears this line.
    await load();

    $("flash").textContent = !response.ok ? (body.error || "reset refused")
      : body.removed ? body.removed + " archived to " + body.archive
      : "nothing to reset";
  }

  addEventListener("keydown", (event) => {
    /* Nothing on this page is a shortcut while the reset dialog is up. The
       input guard below covers someone typing their name, but not someone who
       clicked the dialog's own background first — and at that point "p" would
       pass the item sitting behind the modal. Returning rather than
       preventing: Escape still reaches the dialog and closes it. */
    if ($("resetBox").open) return;

    // Escape cancels a half-typed number before it closes anything.
    if (event.key === "Escape") { if (buffer) clearDigits(); else togglePanel(false); return; }

    // Checkboxes are inputs but not text entry, and clicking a row focuses
    // one — excluding them here would kill the shortcuts after any click.
    if (event.target.matches("textarea, input:not([type=checkbox])")) return;
    if (!state || !state.item) return;

    if (event.key === "d") { togglePanel(); return; }

    // Only while the list is on screen: a diagnosis silently ticked behind a
    // closed panel is worse than one that was never offered.
    if (!$("panel").hidden && /^[0-9]$/.test(event.key)) { typeDigit(event.key); return; }

    if (buffer) clearDigits();
    if (event.key === "p") send("pass");
    if (event.key === "f") send("fail");
    if (event.key === "u") send("unknown");
  });

  /* The sticky column has to start below the header and stop above the dock,
     and both are sized by their contents — the header by however long the
     rater's name is, the dock by the button text. A hardcoded pair of values
     is right until someone is called something long. */
  function setChrome() {
    const root = document.documentElement.style;
    root.setProperty("--head", document.querySelector("header").offsetHeight + "px");
    root.setProperty("--dock", $("dock").offsetHeight + "px");
  }

  addEventListener("resize", setChrome);
  setChrome();
  load();
</script>
</html>
`;
