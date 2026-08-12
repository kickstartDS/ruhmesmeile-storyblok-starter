/**
 * 3.4 — the four judge rubrics (PRD §7.3).
 *
 * Each rubric is one isolated call. They are not batched into a single prompt
 * asking for four scores, because a model asked to rate four things at once
 * anchors them to each other: a component that is obviously wrong on design
 * intent drags its API-design score down with it, and the four dimensions stop
 * being four measurements. Isolation costs four times as much and is the entire
 * reason the judge is worth having.
 *
 * Every rubric may answer `unknown`. That escape hatch is load-bearing: the
 * alternative to "I cannot tell" is not silence, it is a confident number, and
 * a confident number is indistinguishable from a real one once it reaches a
 * spreadsheet. `unknown` is recorded and excluded from the mean rather than
 * scored zero — the same rule `applicable` already follows for deterministic
 * graders.
 *
 * The rubrics deliberately do not ask "is this good code". They ask about the
 * four things the deterministic graders provably cannot reach: whether the
 * result belongs to *this* design system, whether token choices are
 * semantically right rather than merely valid, whether the public API would
 * survive contact with a second use case, and whether it reads like the
 * surrounding codebase. Anything a regex can settle is already settled.
 */

export interface Rubric {
  id: string;
  /**
   * One line, shown as the check label in reports and as the heading a human
   * grader reads before the criterion.
   *
   * `design-intent` and `code-idiom` are worded as a pair on purpose. "Is
   * shaped like a component of this design system" and "Reads like the rest of
   * the codebase" are the same sentence twice — both name a subject, both
   * subjects are convention, and nothing in either says which one you are
   * supposed to care about more. Naming the repair cost is the only thing that
   * has ever separated them (D-135 amendment), so it goes in the label rather
   * than being left for the criterion to establish four paragraphs in.
   *
   * Free to reword: unlike `criterion`, this is not hashed and no cached
   * verdict depends on it.
   */
  label: string;
  /** What the judge is asked. Rendered into the user message verbatim. */
  criterion: string;
  /**
   * What to show the judge. Component source is always included; these add to
   * it, and cost tokens, so each is opt-in per rubric.
   */
  include: {
    prompt?: boolean;
    styles?: boolean;
    schema?: boolean;
    tokenNames?: boolean;
    /**
     * The client-behaviour file, where the agent wrote one.
     *
     * The system prompt lets a judge infer *misplaced* behaviour from the
     * component alone — React state is visible proof the behaviour is not in
     * the client bundle — and that inference is why this was survivable for so
     * long. It is one-sided: it catches the wrong answer and cannot see the
     * right one. An agent that correctly wrote `Disclosure.client.js` had the
     * entire artefact withheld, so whether it extends the `Component`/`define`
     * base, keeps `aria-expanded` in sync, or removes its listeners never
     * reached any rubric. On `832-client-behaviour`, the one task in the suite
     * whose subject *is* that convention, the judge was scoring markup and a
     * stylesheet (D-129).
     */
    client?: boolean;
    /** Real components from the design system, as a reference to compare against. */
    exemplars?: boolean;
  };
  /**
   * Material this rubric cannot be asked without.
   *
   * A rubric that is shown less than it needs does not abstain — it fills the
   * gap. `api-design` was asked about a schema the brief calls authoritative
   * but which the agent did not write and so was not shown, and it invented
   * that schema's contents on seven of forty-eight trials, twice failing a
   * component for correctly matching the real one (D-102). Where the material
   * is missing the question is not asked at all.
   */
  requires?: Array<"styles" | "schema" | "component">;
  /**
   * Whether this rubric's verdicts are allowed to move the composite score.
   *
   * A rubric is a measuring instrument, and an instrument that has not been
   * checked against a known reading is decoration. 3.6/3.7 hand-grade a sample
   * of trials and compute agreement per rubric; only a rubric that clears the
   * ≥80% bar earns this flag. Until then the judge is still asked, its answers
   * are still cached and still shown in reports — they simply do not count.
   *
   * `api-design` is the standing reason this flag exists. It was withdrawn for
   * confabulating a schema it had never been shown (D-102) and then narrowed by
   * `requires` so it is only asked where the agent authored the API (D-100).
   * That narrowing means every eval in the Phase 1 matrix returns no material
   * for it, so there is nothing to calibrate against yet — `824-api-from-
   * behaviour` is the first task that will produce any. Leaving the rubric
   * ungated would hand it weight the moment `824` runs, on the strength of a
   * fix that has never been tested. (D-112.)
   */
  calibrated?: boolean;
}
/**
 * Rubric pairs that ask about the same artefact at different repair costs, as
 * `[structural, conventional]`.
 *
 * `design-intent` and `code-idiom` both judge conventions — the search for a
 * category of objection that is "not idiom" came up empty, because there isn't
 * one. What separates them is what it costs to be wrong: code-idiom's failures
 * are fixed by moving a file or a find-and-replace, and design-intent's are
 * not. React state where a client bundle belongs is not a rename.
 *
 * **The nesting claim this constant was written for is dead (D-139).** It read:
 * if the two differ only by cost then they are a severity ladder, so a
 * candidate cannot be foreign in construction while flawless in convention, and
 * `fail`/`pass` in that order should be as loud as an error. 48 comparable
 * trials had produced no inversion, which is what made it worth encoding
 * (D-135 amendment).
 *
 * The first run under the rewritten criteria produced one, and a clean one.
 * `cc-both/840-reuse-over-native/run-1`: design-intent failed it for
 * instantiating its client behaviour in a `useEffect` instead of `define()`,
 * "would require rewriting the behaviour integration approach"; code-idiom
 * passed it on naming, prefix, token partial, Context, `forwardRef` and
 * stylesheet organisation, explicitly excusing the one placement deviation as
 * "a reasonable organisational choice rather than a dialect violation".
 *
 * So the subset relation was an artefact of the contamination it was inferred
 * from. Old code-idiom was told to judge "how props are threaded" and cited
 * Context/Provider in 4 of its 11 solo failures — it was partly grading shape,
 * which made it fail wherever design-intent failed. Confine each rubric to its
 * own repair-cost band and they come apart immediately, which is the two
 * independent measurements D-134 was trying to get.
 *
 * The pair stays, and the check stays, but neither is an invariant now. Fail
 * plus pass is the most interesting cell in the matrix rather than an alarm:
 * a candidate that clears every mechanical convention check and is still built
 * wrong is precisely what the deterministic graders cannot reach, and the
 * reason there is a judge at all. It is reported, not enforced.
 */
export const PAIRED: ReadonlyArray<readonly [string, string]> = [
  ["design-intent", "code-idiom"],
];
export const RUBRICS: Rubric[] = [
  {
    id: "design-intent",
    calibrated: true,
    label: "Built like this design system — differences need a rewrite",
    /**
     * The stylesheet is deliberately withheld (D-134).
     *
     * With it, this rubric saw a strict superset of what `code-idiom` saw and
     * was asked a question phrased almost the same way, and the verdicts came
     * back accordingly: across 60 trials the two agreed 47 times, and all 13
     * disagreements were design-intent passing where code-idiom failed. Not one
     * trial had design-intent fail alone. A rubric whose failures are a subset
     * of another's is not a second measurement, it is a coarser copy of the
     * first — and the shared stylesheet was the largest thing inviting the
     * overlap, since class-name scoping and stylesheet organisation are exactly
     * what code-idiom is for.
     *
     * `client` stays. Where behaviour lives is a question about shape, not
     * naming, and withholding it is one-sided in the way D-129 describes.
     */
    include: { prompt: true, client: true, exemplars: true },
    /*
     * Declared, not emergent.
     *
     * Withholding the stylesheet already made this rubric unaskable on all
     * twelve `812-restyle-with-tokens` trials: the agent edits only the
     * stylesheet there, the component and schema are unmodified fixtures that
     * `authored()` drops, and the material came out empty. That is the right
     * outcome — a restyle contains no construction to judge — but it held by
     * accident of one task's file set rather than by anything saying so, and
     * the next task that edits a stylesheet *and* touches the component would
     * have had this rubric grading a shape nobody changed (D-135 amendment).
     */
    requires: ["component"],
    criterion: `Does this component take the shape a component of the kickstartDS design system takes?

You have been given real components from that design system as reference. Judge
the candidate's shape against them and against the brief — the structure of its
markup, what it made configurable and what it fixed, how states and variants are
expressed, where its behaviour lives, and whether this is the kind of component
the brief called for at all.

The test is what it would cost to fix your objection. This rubric is for the
objections that cannot be settled without rewriting the component. If the fix is
renaming an identifier, moving a file, changing an import, adding a missing file
alongside the ones that are there, or a find-and-replace, then it is not an
objection this rubric wants — another rubric is asking about exactly that, and
it does not need your help. If your objection survives renaming every identifier
in the candidate and moving every file it wrote, it is one of yours.

You are deliberately not shown the stylesheet, for the same reason: almost
nothing that can be seen in it costs a rewrite to fix.

A component can be entirely correct, idiomatically named, and still be the wrong
shape: a single element where the references use a compound, a free-form variant
string where the references use a closed set, behaviour threaded through props
where the references keep it in the client bundle. That is what this rubric is
for, and it is a "fail" — say so plainly when the candidate is competent but
foreign.

Do not reward or punish visual taste. Answer "unknown" only if the reference
components do not speak to the kind of component being judged.`,
  },
  {
    id: "token-reasoning",
    calibrated: true,
    label: "Token choices are semantically right, not merely valid",
    include: { styles: true, tokenNames: true },
    criterion: `Are the design tokens used here the semantically correct ones?

A stylesheet can reference nothing but real tokens and still be wrong: using a
brand colour where a semantic foreground token is meant, reaching for a heading
token to size body copy, or hard-coding a value that a token exists for. The
deterministic graders already checked that every token referenced exists and
that no raw hex values were used — you are judging *choice*, not validity.

Say "unknown" rather than guessing when a token's intended meaning is not
recoverable from its name.`,
  },
  {
    id: "api-design",
    calibrated: false,
    label: "The public API would survive a second use case",
    include: { prompt: true, schema: true, exemplars: true },
    requires: ["schema"],
    criterion: `Is this a sensible public API for the component?

Judge the surface the author actually defined — the component's props, their
names, their types, and what they leave impossible. Where a schema written by
the author is shown, judge that too; where none is shown, the props are the API.
The reference components show what a published API looks like here.

Good signs: names that describe intent rather than implementation, variants as a
closed set rather than free strings, no prop that exists only to leak styling
through. Bad signs: booleans that will need to become enums the first time a
third variant appears, props that must be set together but are independent,
required props with no sensible default meaning.

Judge the API as published surface — something another team would depend on —
not as the shortest thing that satisfies the brief.`,
  },
  {
    id: "code-idiom",
    calibrated: true,
    label: "Written like this codebase — differences need an edit",
    include: { styles: true, client: true, exemplars: true },
    criterion: `Does this code read like the design system it was added to?

The reference components are the local idiom — they define what "like the rest
of the codebase" means here. Compare what a reviewer would have to correct by
hand before merging: file names and where files are placed, what is imported
from where, class-name prefixes and scoping, whether the conventional companion
files are present, and how the stylesheet and its tokens are organised. A
component that is correct but written in a noticeably different dialect than the
references costs a reviewer real time, and should fail.

This rubric is bounded on both sides. Below it: ignore formatting a formatter
would fix, and ignore anything already covered by lint. Above it: ignore
anything that could only be fixed by rewriting the component — how it is
composed, what it takes as props, where its behaviour lives, whether it forwards
a ref, whether consumers can substitute it. Those are real objections, and
another rubric is asking about them; raising them here does not count them
twice, it makes this measurement a copy of that one. A candidate that is built
wrong but named, placed and imported exactly the way the references are is a
"pass" here.

Answer "unknown" only if the references genuinely do not establish a convention
on the points where the candidate differs.`,
  },
];
