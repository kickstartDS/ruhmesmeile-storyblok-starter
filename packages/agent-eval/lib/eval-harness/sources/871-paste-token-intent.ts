/**
 * 871 — 811, run by someone with no repository.
 *
 * Identical task, identical prompt, identical assertions. The fixture ships no
 * `src/token/`, which is the whole experiment: `811` measured the design-tokens
 * server against 1,575 greppable custom properties sitting in the workspace,
 * and could not tell "this tool is redundant" apart from "this tool is
 * redundant *here*" (D-159).
 *
 * The other audience is the person who pastes a stylesheet into a chat window.
 * They have their snippet and nothing else — no checkout, no `grep`, no token
 * layer. For them the lookup half of the server is not redundant at all, and
 * the reasoning half is unusable without it, because `validate_token_usage`
 * cannot validate a token the model had no way to learn the name of.
 *
 * Nothing is denied by permission and nothing is hidden. The agent may search
 * as much as it likes; there is simply nothing to find. That is the honest
 * shape of the context rather than a simulation of it.
 *
 * The assertions are re-used rather than re-stated. Importing the source
 * registers its `test()` calls as if they were written here, and the fixture
 * digests baked into *this* eval's bundle are this fixture's own, so
 * `shipped()` still compares against the right files. If the two graders were
 * copies they would drift, and the pair would stop measuring one variable.
 */

import "./811-token-intent";
