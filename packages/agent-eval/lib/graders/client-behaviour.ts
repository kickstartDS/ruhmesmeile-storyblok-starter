/**
 * Runtime behaviour, checked statically.
 *
 * The task requires a dismissible badge to actually dismiss. A component can
 * satisfy every structural rule and still not do the thing it was asked to do,
 * and until stories run in a browser (1.9/1.10) this is the only grader that
 * looks at behaviour at all.
 */

import { discover, discoverGraded, stripComments } from "./discover";
import { check, result, notApplicable, type GraderResult } from "./types";
import { readFile, type Trial } from "./trial";

export function clientBehaviour(trial: Trial): GraderResult {
  if (!trial.target.requiresClientBehaviour) {
    return notApplicable(
      "client-behaviour",
      "runtime",
      "task requires no client behaviour",
    );
  }

  const found = discoverGraded(trial);
  if (found.client.length === 0) {
    // On a diff task the fixture may already ship working client behaviour.
    // Leaving it alone is the correct answer, not a missing file: `860` is a
    // restraint eval whose shipped `Tag.client.js` should come back untouched.
    if (discover(trial).client.length > 0) {
      return notApplicable(
        "client-behaviour",
        "runtime",
        "the shipped client behaviour was left untouched",
      );
    }

    return result("client-behaviour", "runtime", [
      check("exists", "a client behaviour file exists", false),
      check("wired", "behaviour is attached to the DOM", false),
      check("cleanup", "listeners are cleaned up", false),
    ]);
  }

  const sources = found.client
    .map((path) => stripComments(readFile(trial, path) ?? ""))
    .join("\n");

  return result("client-behaviour", "runtime", [
    check(
      "exists",
      "a client behaviour file exists",
      sources.trim().length > 0,
    ),
    check(
      "wired",
      "behaviour is attached to the DOM",
      /addEventListener|define\s*\(/.test(sources),
      /addEventListener|define\s*\(/.test(sources)
        ? undefined
        : "no event wiring found",
    ),
    check(
      "cleanup",
      "listeners are cleaned up",
      /removeEventListener|onDisconnect|disconnectedCallback|AbortController/.test(
        sources,
      ),
    ),
  ]);
}
