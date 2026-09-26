/**
 * Provider wiring for non-Anthropic endpoints that speak the Anthropic API.
 *
 * D-170 established that this is configuration rather than a harness change:
 * `run.mjs` forwards `model` to the CLI as an opaque string, and the `env`
 * block of `.claude/settings.local.json` reaches the sandbox when the host
 * environment does not. Everything here rides those two facts.
 *
 * The values are read from `process.env` at definition time and land in a file
 * inside the sandbox, so a credential must never be written as a literal.
 */

/** Novita's Anthropic-compatible endpoint. */
const NOVITA_BASE_URL = "https://api.novita.ai/anthropic";

export interface Provider {
  model: string;
  providerEnv: Record<string, string>;
}

/**
 * Route Claude Code at Novita.
 *
 * `ANTHROPIC_API_KEY` is blanked deliberately. The orchestrator sets it on the
 * sandbox process from the harness's own credentials, and leaving it populated
 * alongside `ANTHROPIC_AUTH_TOKEN` leaves which one wins to the CLI's
 * precedence rules. The first spike proved the settings block does win — the
 * 403 that came back was Novita's key policy, which Anthropic could not have
 * produced for a model it has never heard of — but a silent fallback to
 * Anthropic is the one failure this whole path cannot detect from a green run,
 * so the ambiguity is removed rather than relied upon.
 *
 * `ANTHROPIC_SMALL_FAST_MODEL` matters as much as the main model: Claude Code
 * uses it for its own background work (titles, summarisation, compaction). Left
 * unset it points at a Claude model that this endpoint cannot serve, and the
 * failure surfaces mid-run rather than at startup.
 */
export function novita(model = process.env.NOVITA_MODEL): Provider {
  const apiKey = process.env.NOVITA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NOVITA_API_KEY is not set.\n" +
        "  NOVITA_API_KEY=… pnpm eval <experiment> --force",
    );
  }
  if (!model) {
    throw new Error(
      "No model given and NOVITA_MODEL is not set.\n" +
        "  List what the key allows:\n" +
        "    curl -s https://api.novita.ai/openai/v1/models \\\n" +
        "      -H \"Authorization: Bearer $NOVITA_API_KEY\" | jq -r '.data[].id'",
    );
  }

  return {
    model,
    providerEnv: {
      ANTHROPIC_BASE_URL: NOVITA_BASE_URL,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_MODEL: model,
      ANTHROPIC_SMALL_FAST_MODEL: model,
    },
  };
}

/**
 * The model the DeepSeek cohort runs on.
 *
 * Pinned rather than read from the environment, because the arm name says
 * `deepseek` and the results directory is named after the model: an arm that
 * silently changes model between runs would write into a different path and
 * pool two models under one label. Override for a spike, never for a cohort.
 */
export const DEEPSEEK_MODEL = "deepseek/deepseek-v4.1-flash";

/**
 * The model the GLM cohort runs on. Pinned for the same reason as above.
 *
 * Note the vendor segment differs in shape from DeepSeek's: `zai-org` puts a
 * hyphen inside a path segment, so this model's results land under
 * `results/{arm}/zai-org/glm-5.3-flash/{stamp}`. That is two directories deep
 * like DeepSeek's, which `listRuns` (D-171) and `newest_run` (D-172) both
 * handle by searching for the timestamp rather than counting levels — the
 * hyphen is only a problem for code that splits paths on it, and nothing does.
 *
 * The *arm* name is the place a hyphen would bite, because `parseArm` derives
 * the variant from everything between the first segment and the last two. The
 * cohort label is therefore `glm`, not `zai-org-glm`, which keeps
 * `cc-component-builder-glm-default` parsing as variant `component-builder` in
 * cohort `glm-default`.
 */
export const GLM_MODEL = "zai-org/glm-5.3-flash";

/**
 * Wall-clock ceiling for the GLM arms, in seconds. 90 minutes against the
 * campaign default's 30.
 *
 * GLM is slow in a way its pricing card does not hint at. Measured over the
 * first full grid: median trial 632s against DeepSeek's 201s, a 3.1× factor at
 * the middle of the distribution and worse in the tail. The default 1800s
 * ceiling sat at the cohort's p90, so it was not stopping wedged trials — it
 * was truncating the distribution, and truncating it from the slow end, which
 * is the end where the hard tasks live.
 *
 * The censoring was not random, and that is what makes it dangerous rather
 * than merely wasteful. The two evals that timed out on all four arms,
 * `810-atom-from-schema` and `840-reuse-over-native`, are precisely the two
 * slowest evals on DeepSeek (401s and 404s median, against a 201s cohort
 * median). Dropping them raises every arm's mean quality by removing its
 * hardest work, and it does so unevenly across arms.
 *
 * 5400s is set from the failures rather than from the successes, because the
 * successes are the ones the old ceiling already admitted. All three runs of
 * `810` exceeded 1800s, so its true GLM factor is above 1800/401 = 4.5×, not
 * the cohort's 3.1×; 401s × 4.5 × a 2× allowance for spread lands near 3600s,
 * and the margin above that buys the case this ceiling is supposed to catch.
 * A second censored run costs more than a generous ceiling: a killed trial
 * pays for its whole wall clock and returns nothing to grade.
 */
export const GLM_TIMEOUT = 5400;
