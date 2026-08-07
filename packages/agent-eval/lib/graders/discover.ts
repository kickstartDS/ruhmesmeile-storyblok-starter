/**
 * Locating what the agent actually produced.
 *
 * Graders must not assume the contract was followed — that is the thing being
 * measured. Discovery finds the component, stylesheet, client file and schema
 * by role, however they were named, so that a wrongly named file is penalised
 * once by the contract grader and still graded on its content by every other
 * grader. Without this, a single naming mistake would zero out purity, BEM and
 * token conformance too, and one error would be counted five times.
 */

import { contractFor } from "./contract";
import { filesIn, filesUnder, untouched, type Trial } from "./trial";

export interface Discovered {
  /** The component implementation, contract-named or not. */
  component: string | null;
  /** True when it sits at the contract's path. */
  componentOnContract: boolean;
  /** Main stylesheet, excluding token partials. */
  styles: string | null;
  stylesOnContract: boolean;
  /** Component-token partial, if any. */
  tokens: string | null;
  /** Client-behaviour files, at any accepted location. */
  client: string[];
  clientOnContract: boolean;
  schema: string | null;
  /** Everything in the component directory, for stray-file reporting. */
  all: string[];
}

const isStoryOrTest = (name: string): boolean =>
  /\.(stories|test|spec)\.[jt]sx?$/.test(name);

const isTokenPartial = (name: string): boolean =>
  /^_/.test(name) || /-(tokens|vars|variables)\.(scss|css)$/.test(name);

export function discover(trial: Trial): Discovered {
  const { dir, slug } = trial.target;
  const contract = contractFor(slug);
  const names = filesIn(trial, dir);
  const nested = filesUnder(trial, dir);

  const componentCandidates = names.filter(
    (name) => name.endsWith(".tsx") && !isStoryOrTest(name),
  );
  const component = names.includes(contract.component)
    ? contract.component
    : // Prefer a name that at least mentions the component over an index barrel.
      (componentCandidates.find((name) => /component/i.test(name)) ??
      componentCandidates.find((name) => !/^index\./.test(name)) ??
      componentCandidates[0] ??
      null);

  const styleCandidates = names.filter(
    (name) => /\.(scss|css)$/.test(name) && !isTokenPartial(name),
  );
  const styles = names.includes(contract.styles)
    ? contract.styles
    : (styleCandidates[0] ?? null);

  const tokens =
    names.find((name) => name === contract.tokens) ??
    names.find((name) => isTokenPartial(name) && /\.(scss|css)$/.test(name)) ??
    null;

  const client = nested.filter(
    (name) => /\.client\.[jt]sx?$/.test(name) || /^js\//.test(name),
  );
  const clientOnContract = client.some((name) =>
    contract.clientCandidates.includes(name),
  );

  return {
    component: component ? `${dir}/${component}` : null,
    componentOnContract: component === contract.component,
    styles: styles ? `${dir}/${styles}` : null,
    stylesOnContract: styles === contract.styles,
    tokens: tokens ? `${dir}/${tokens}` : null,
    client: client.map((name) => `${dir}/${name}`),
    clientOnContract,
    schema: nested.includes(contract.schema)
      ? `${dir}/${contract.schema}`
      : null,
    all: nested,
  };
}

/** Strip comments so that a rule never fires on prose or commented-out code. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * Discovery for the graders that judge file *content*.
 *
 * On a build-from-scratch eval this is plain `discover`. On a diff-style eval
 * (`Target.diffTask`) it hides every file the agent left byte-identical to the
 * fixture, so those graders report `n/a` and drop out of the mean rather than
 * scoring the fixture author. `component-contract` deliberately does not use
 * this view — it asks whether the right files exist, which is still a fair
 * question when the fixture supplied them.
 */
export function discoverGraded(trial: Trial): Discovered {
  const found = discover(trial);
  if (!trial.target.diffTask) return found;

  const kept = (path: string | null) =>
    path && !untouched(trial, path) ? path : null;

  return {
    ...found,
    component: kept(found.component),
    styles: kept(found.styles),
    tokens: kept(found.tokens),
    client: found.client.filter((path) => !untouched(trial, path)),
    schema: kept(found.schema),
  };
}
