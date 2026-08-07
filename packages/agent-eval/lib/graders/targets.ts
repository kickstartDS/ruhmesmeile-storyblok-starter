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
}

export const TARGETS: Record<string, Target> = {
  "810-atom-from-schema": {
    slug: "badge",
    dir: "src/components/badge",
    requiresClientBehaviour: true,
    schemaProperties: ["dismissible", "icon", "label", "size", "variant"],
    delegatedElements: [],
    mcpUseExpected: true,
    diffTask: false,
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
  },
  "832-client-behaviour": {
    slug: "disclosure",
    dir: "src/components/disclosure",
    requiresClientBehaviour: true,
    schemaProperties: ["content", "defaultOpen", "id", "summary"],
    delegatedElements: [],
    mcpUseExpected: true,
    diffTask: false,
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
  },
};

export function targetFor(evalName: string): Target | null {
  return TARGETS[evalName] ?? null;
}
