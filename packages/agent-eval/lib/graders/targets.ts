/**
 * What each eval expects to have been built.
 *
 * Deliberately host-side. Putting this next to the fixture would upload it into
 * the sandbox, where the agent could read the expectations it is being graded
 * against (ADR Decision 17).
 */

export interface Target {
  /** kebab-case component slug — directory name, stylesheet stem, schema stem. */
  slug: string;
  /** Directory the component must be implemented in, relative to project root. */
  dir: string;
  /** Whether the task requires runtime behaviour in a client file. */
  requiresClientBehaviour: boolean;
  /** Properties the supplied schema declares. The agent must not change these. */
  schemaProperties: string[];
  /**
   * Native elements the agent is expected to delegate to a design-system
   * component instead of hand-rolling. Empty when the fixture ships no design
   * system to delegate to (P1: the fixture is standalone React).
   */
  delegatedElements: string[];
  /**
   * Whether an MCP arm that never calls an MCP server is confounded.
   *
   * True for build-from-scratch tasks: the servers are the treatment, so a
   * trial that ignored them measured the baseline and must be excluded.
   *
   * False for small-diff tasks, where reaching for a server is itself the
   * wrong move. `860` is a one-line accessible-name fix; consulting a token
   * catalogue to write an `aria-label` is exactly the over-engineering the
   * eval scores. Excluding those trials threw away all nine MCP-arm samples
   * and marked three arms invalid for behaving correctly.
   */
  mcpUseExpected: boolean;

  /**
   * Whether the fixture ships a working component and asks for a change to it.
   *
   * On these, content graders judge only the files the agent actually edited.
   * Everything it correctly left alone drops out of the mean instead of scoring
   * the fixture's own authoring — `860` was losing half of `style-placement`
   * and half of `purity` on a stylesheet and a component it was right not to
   * touch, identically in all four arms. See ADR 41.
   */
  diffTask: boolean;
  /**
   * Which tier the task runs in.
   *
   * Tiering is by *measured cost*, not by subject. Phase 1 priced a greenfield
   * trial at $4.24–$5.67 and an edit trial at $0.23 — a factor of twenty. A
   * suite that runs every task on every campaign is therefore priced by its
   * greenfield tasks alone, and the cheap ones are effectively free riders.
   *
   * `core` runs on every campaign. All of them are edit or diff tasks against
   * a shipped component, so the whole tier costs about what two greenfield
   * tasks do. This is the tier that works as a routine drift gate.
   *
   * `extra` runs only under `EVAL_EXTRA_EVALS=1`. These are the
   * build-from-scratch tasks: they carry most of the capability signal and
   * essentially all of the cost, so they are bought deliberately rather than
   * on every invocation.
   */
  tier: "core" | "extra";
}

export const TARGETS: Record<string, Target> = {
  "802-composite-from-two": {
    slug: "testimonial",
    dir: "src/components/testimonial",
    // Nothing to click: a quote, a picture and a score.
    requiresClientBehaviour: false,
    schemaProperties: [
      "authorName",
      "authorRole",
      "portraitSrc",
      "quote",
      "rating",
      "ratingLabel",
    ],
    // Both halves of the card are delegated to components that already exist,
    // so the composite's own markup legitimately contains neither.
    delegatedElements: ["img", "svg"],
    // `list-existing-components` is the affordance under test, and unlike 840
    // the components to find are in the source tree rather than node_modules.
    mcpUseExpected: true,
    diffTask: false,
    // Build-from-scratch, and therefore priced like one.
    tier: "extra",
  },
  "804-story-conventions": {
    slug: "price-tag",
    dir: "src/components/price-tag",
    requiresClientBehaviour: false,
    schemaProperties: ["amount", "note", "period", "variant"],
    delegatedElements: [],
    // `pack`, `getArgsShared`, the `jsonschema` and `cssprops` parameters —
    // none of it is guessable from Storybook's own documentation, and all of it
    // is in `get-storybook-template` verbatim. The sharpest knowledge probe in
    // the suite.
    mcpUseExpected: true,
    diffTask: true,
    tier: "extra",
  },
  "806-inverted-context": {
    slug: "spotlight",
    dir: "src/components/spotlight",
    requiresClientBehaviour: false,
    schemaProperties: ["body", "footnote", "heading"],
    delegatedElements: [],
    // The most direct test of the tokens server in the suite: that inversion
    // lives in the token layer is not derivable from the component, and is
    // precisely what `design-tokens` documents.
    mcpUseExpected: true,
    diffTask: true,
    tier: "core",
  },
  "810-atom-from-schema": {
    slug: "badge",
    dir: "src/components/badge",
    requiresClientBehaviour: true,
    schemaProperties: ["dismissible", "icon", "label", "size", "variant"],
    delegatedElements: [],
    mcpUseExpected: true,
    diffTask: false,
    // Grandfathered into `81x` despite being a core build-from-spec task: it
    // carries every Phase 1 result and the largest sample in the suite (n=51),
    // and renaming it would cost that comparability for a tidier number.
    tier: "extra",
  },
  "812-restyle-with-tokens": {
    slug: "alert",
    dir: "src/components/alert",
    // A restyle: the component ships complete and the stylesheet is the only
    // thing that is wrong. Requiring a client file here would penalise
    // correctly leaving a working component alone.
    requiresClientBehaviour: false,
    schemaProperties: ["compact", "message", "title", "variant"],
    delegatedElements: [],
    // A full restyle against the token system: the token server is the point.
    mcpUseExpected: true,
    diffTask: true,
    // A full restyle runs long enough to price like a greenfield task ($46 a
    // matrix in Phase 1), so it is bought rather than run by default.
    tier: "extra",
  },
  "816-typography-pairing": {
    slug: "article-teaser",
    dir: "src/components/article-teaser",
    requiresClientBehaviour: false,
    schemaProperties: ["excerpt", "kicker", "readingTime", "title"],
    delegatedElements: [],
    // The `typography-pairing` rule lives in the tokens server and nowhere
    // else: every token in the shipped stylesheet is real and semantic, so
    // there is nothing here for an arm without it to notice.
    mcpUseExpected: true,
    diffTask: true,
    // A stylesheet-only fix, but the reasoning is deep enough to be worth a
    // full matrix rather than a default run.
    tier: "extra",
  },
  "820-extend-schema-safely": {
    slug: "avatar",
    dir: "src/components/avatar",
    requiresClientBehaviour: false,
    schemaProperties: ["imageSrc", "name", "size"],
    delegatedElements: [],
    // Optional prop, schema `default`, BEM modifier: the whole answer is house
    // convention, and `component-builder` hands out every part of it.
    mcpUseExpected: true,
    diffTask: true,
    tier: "core",
  },
  "824-api-from-behaviour": {
    slug: "progress-steps",
    dir: "src/components/progress-steps",
    // Static presentation of where you are in a flow; nothing to click.
    requiresClientBehaviour: false,
    // Empty on purpose, and the only target where it is. The fixture ships no
    // schema — the agent designs the API and writes it — so there is no
    // supplied property list to hold it to. `component-contract` skips the
    // comparison when this is empty; the schema is instead judged, which is the
    // whole reason the task exists (D-102).
    schemaProperties: [],
    delegatedElements: [],
    // Build-from-scratch: the servers are the treatment.
    mcpUseExpected: true,
    diffTask: false,
    tier: "extra",
  },
  "811-token-intent": {
    slug: "stat",
    dir: "src/components/stat",
    // The stylesheet is the only wrong thing; the component ships working.
    requiresClientBehaviour: false,
    schemaProperties: ["delta", "label", "trend", "value"],
    delegatedElements: [],
    // Choosing between 1,522 visible token names by design intent is precisely
    // what the tokens server encodes rules for. Ignoring it is the baseline.
    mcpUseExpected: true,
    diffTask: true,
    tier: "core",
  },
  "817-responsive-tokens": {
    slug: "page-header",
    dir: "src/components/page-header",
    requiresClientBehaviour: false,
    schemaProperties: ["eyebrow", "summary", "title"],
    delegatedElements: [],
    // Knowing that `--ks-spacing-*` is breakpoint-scaled is exactly what the
    // tokens server encodes. An arm holding it that never asks measured the
    // baseline.
    mcpUseExpected: true,
    diffTask: true,
    tier: "core",
  },
  "818-component-token-layer": {
    slug: "callout",
    dir: "src/components/callout",
    requiresClientBehaviour: false,
    schemaProperties: ["body", "emphasis", "heading"],
    delegatedElements: [],
    // Introducing the `--dsa-*` layer is exactly what both servers document.
    // An arm that holds one and never calls it measured the baseline.
    mcpUseExpected: true,
    diffTask: true,
    tier: "core",
  },
  "832-client-behaviour": {
    slug: "disclosure",
    dir: "src/components/disclosure",
    requiresClientBehaviour: true,
    schemaProperties: ["content", "defaultOpen", "id", "summary"],
    delegatedElements: [],
    mcpUseExpected: true,
    diffTask: false,
    tier: "extra",
  },
  "836-behaviour-bugfix": {
    slug: "dismissible",
    dir: "src/components/dismissible",
    requiresClientBehaviour: true,
    schemaProperties: ["closeLabel", "message"],
    delegatedElements: [],
    // The house convention for client behaviour — a class, bound handlers, a
    // `destroy()` that unwinds everything the constructor bound — is what
    // `get-client-behavior-template` hands out. An arm holding it should find
    // the missing half of `destroy()` faster than one reasoning from scratch.
    mcpUseExpected: true,
    diffTask: true,
    tier: "core",
  },
  "840-reuse-over-native": {
    slug: "notification-banner",
    dir: "src/components/notification-banner",
    requiresClientBehaviour: true,
    schemaProperties: [
      "actionIcon",
      "actionLabel",
      "dismissLabel",
      "headline",
      "message",
      "variant",
    ],
    // The fixture vendors Button, Icon, Headline and Text under
    // @kickstartds/ds. These are the elements those components exist to
    // replace, and hand-rolling one is what `ds-reuse` scores.
    delegatedElements: ["button", "h1", "h2", "h3", "h4", "h5", "h6", "svg"],
    mcpUseExpected: true,
    diffTask: false,
    tier: "extra",
  },
  "842-reuse-edit": {
    slug: "promo-tile",
    dir: "src/components/promo-tile",
    requiresClientBehaviour: false,
    schemaProperties: ["actionIcon", "actionLabel", "body", "headline"],
    // Same vendored library as 840, but the native control is already there
    // and working. Deleting it in favour of the dependency is a different
    // decision from choosing the dependency on a blank page, and the campaign
    // has no evidence about it.
    delegatedElements: ["button", "svg"],
    mcpUseExpected: true,
    diffTask: true,
    tier: "core",
  },
  "850-focus-return": {
    slug: "filter-flyout",
    dir: "src/components/filter-flyout",
    requiresClientBehaviour: true,
    schemaProperties: ["flyoutOptions", "id", "triggerLabel"],
    delegatedElements: [],
    // False, like 852 and for the same reason: nothing in either server
    // mentions focus, Escape or keyboard behaviour. The client-behaviour
    // template is in the component-builder server though, which makes this the
    // stronger control of the two — the tool an agent will reach for exists,
    // and still says nothing about the thing being graded.
    mcpUseExpected: false,
    diffTask: true,
    tier: "core",
  },
  "852-a11y-repair": {
    slug: "media-card",
    dir: "src/components/media-card",
    requiresClientBehaviour: false,
    schemaProperties: ["imageSrc", "summary", "tags", "title"],
    delegatedElements: [],
    // Deliberately false. Neither server documents accessibility, so this is
    // the suite's control task: if the arms spread here, the spread is not an
    // MCP effect and every other task's spread needs re-reading.
    mcpUseExpected: false,
    diffTask: true,
    tier: "core",
  },
  "860-restraint": {
    slug: "tag",
    dir: "src/components/tag",
    // Ships working client behaviour. The task is an accessible-name fix, so
    // the client file should come back untouched rather than rewritten.
    requiresClientBehaviour: true,
    schemaProperties: ["label", "removable", "removeLabel"],
    delegatedElements: [],
    // Restraint task: not calling a server is a legitimate outcome, so a
    // zero-call trial still measures the variant. See `mcpUseExpected`.
    mcpUseExpected: false,
    diffTask: true,
    tier: "core",
  },
  "861-token-restraint": {
    slug: "quote",
    dir: "src/components/quote",
    // Presentational; the fixture ships no client behaviour and the task does
    // not ask for any.
    requiresClientBehaviour: false,
    schemaProperties: ["attribution", "source", "text"],
    delegatedElements: [],
    // Restraint task, like `860`: a trial that never calls a server has not
    // been confounded, it has behaved reasonably. The question this task asks
    // is what happens to the arms that *do* call one.
    mcpUseExpected: false,
    diffTask: true,
    tier: "core",
  },
  "862-api-freeze": {
    slug: "rating",
    dir: "src/components/rating",
    requiresClientBehaviour: false,
    schemaProperties: ["kind", "label", "max", "value"],
    delegatedElements: [],
    // Restraint task. See `860` and `861`.
    mcpUseExpected: false,
    diffTask: true,
    tier: "core",
  },
};

export function targetFor(evalName: string): Target | null {
  return TARGETS[evalName] ?? null;
}

/**
 * Eval names in a tier, sorted.
 *
 * `experiment.ts` uses this to build the default eval selection. Sorted so the
 * list is stable across platforms — an unstable order would show up as churn
 * in the run manifest for no reason.
 */
export function evalsInTier(tier: Target["tier"]): string[] {
  return Object.entries(TARGETS)
    .filter(([, target]) => target.tier === tier)
    .map(([name]) => name)
    .sort();
}
