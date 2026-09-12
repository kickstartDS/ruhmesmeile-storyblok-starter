/**
 * 873 — 817 in the paste context.
 *
 * The paired half of `817-responsive-tokens`: identical prompt, identical
 * grader, a fixture with no `src/token/`. See `871-paste-token-intent` for why
 * the context exists and why nothing is denied by permission.
 *
 * This is the second discriminating eval the paste result needed. D-160 rests
 * on `871` alone, and `871` asks the agent to pick the right *token* — a
 * question whose answer is a name. 817's brief asks something a name cannot
 * answer: `--ks-spacing-*` is already breakpoint-scaled, so the fix is to
 * delete the component's own media queries rather than to tokenise the values
 * inside them. That fact lives in the media queries at the bottom of
 * `spacing-token.scss`, which is greppable in a checkout and nowhere at all
 * here. If the design-tokens server carries design *intent* rather than a
 * lookup table, this is where the difference should be largest.
 *
 * 817 is also the one eval whose entry rate stayed at 0/3 across three
 * successive front-door rewrites (D-155, D-157). Either the descriptions never
 * mattered and the filesystem was always the competitor, or the task simply
 * does not read as a token question. Removing the filesystem separates those.
 */

import "./817-responsive-tokens";
