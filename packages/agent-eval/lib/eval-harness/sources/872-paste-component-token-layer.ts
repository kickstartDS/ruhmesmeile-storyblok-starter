/**
 * 872 — 818, run by someone with no repository.
 *
 * The paired paste-context version of `818-component-token-layer`. See
 * `871-paste-token-intent.ts` for why the pair exists and why the assertions
 * are imported rather than restated.
 *
 * This is the harder half of the pair. `811` asks which token is *correct*, a
 * question the token layer on disk could never answer, so removing it changes
 * little. `818` asks the agent to introduce a `--dsa-*` layer of its own, and
 * an agent with a checkout can infer the convention from the `--ks-*` files
 * next to it. With those gone, the convention has to come from the server or
 * from the model's own memory of the design system — which is precisely the
 * gap the Component Builder and Design Tokens servers exist to fill.
 */

import "./818-component-token-layer";
