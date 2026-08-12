/**
 * ANSI syntax highlighting for the hand-grading CLI.
 *
 * Calibration is the most expensive artefact in the project — it is paid for in
 * human attention, one component at a time — and the material is a wall of
 * undifferentiated text. A grader scanning for "does this declare component
 * tokens in the right place" should not also be doing lexical analysis by eye.
 *
 * No new dependency: `prism-react-renderer` is already here for the report
 * host's code blocks, and it ships a Prism instance with `tsx`, `typescript`,
 * `css`, `json` and `javascript` grammars. This module borrows the tokenizer
 * and paints ANSI instead of DOM.
 *
 * `.scss` is highlighted with the `css` grammar deliberately. The bundled Prism
 * has no SCSS grammar, and the design system's stylesheets are almost entirely
 * plain CSS syntax — custom properties, `var()`, `@use`, BEM selectors — with
 * none of the SCSS features (`$variables`, interpolation, control directives)
 * that would make the difference visible. Extending the grammar would be effort
 * spent on constructs this corpus does not contain.
 */

import { Prism } from "prism-react-renderer";

type Token =
  | string
  | { type: string; content: Content; alias?: string | string[] };
type Content = string | Token | Token[];

interface PrismLike {
  languages: Record<string, unknown>;
  tokenize(text: string, grammar: unknown): Token[];
}

const prism = Prism as unknown as PrismLike;

const RESET = "\u001B[0m";

/**
 * Token type (or alias) to SGR parameter.
 *
 * Anything unmapped renders unstyled, which is the correct default: a grammar
 * emitting a type this table has not considered should be legible, not loud.
 */
const COLOURS: Record<string, string> = {
  comment: "90",
  prolog: "90",
  doctype: "90",
  cdata: "90",
  punctuation: "90",
  operator: "90",

  string: "32",
  "attr-value": "32",
  char: "32",
  inserted: "32",

  keyword: "35",
  atrule: "35",
  rule: "35",
  "at-rule": "35",
  boolean: "35",
  builtin: "35",

  function: "36",
  property: "36",
  "class-name": "33",
  "attr-name": "33",
  selector: "33",
  number: "33",
  constant: "33",
  variable: "33",
  symbol: "33",

  tag: "31",
  deleted: "31",
  important: "31",
  regex: "31",
};

const GRAMMARS: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  scss: "css",
  md: "markdown",
};

/**
 * Colour is opt-out on a terminal and off everywhere else.
 *
 * The grading loop is driven by a piped stdin in its only automated test, and a
 * transcript full of escape codes is a transcript nobody reads. `NO_COLOR` is
 * honoured because it is the convention.
 */
const enabled = (): boolean =>
  Boolean(process.stdout.isTTY) &&
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb";

const wrap = (code: string, text: string): string =>
  `\u001B[${code}m${text}${RESET}`;

function paint(tokens: Token[], inherited: string | null): string {
  let out = "";

  for (const token of tokens) {
    if (typeof token === "string") {
      out += inherited ? wrap(inherited, token) : token;
      continue;
    }

    const aliases = token.alias
      ? Array.isArray(token.alias)
        ? token.alias
        : [token.alias]
      : [];
    const colour =
      COLOURS[token.type] ??
      aliases.map((a) => COLOURS[a]).find(Boolean) ??
      inherited ??
      null;

    if (typeof token.content === "string") {
      out += colour ? wrap(colour, token.content) : token.content;
    } else if (Array.isArray(token.content)) {
      out += paint(token.content, colour);
    } else {
      out += paint([token.content], colour);
    }
  }

  return out;
}

/** Highlight one body of code. Falls through unchanged for unknown languages. */
export function highlightCode(code: string, language: string): string {
  if (!enabled()) return code;

  const grammar = prism.languages[GRAMMARS[language] ?? language];
  if (!grammar) return code;

  try {
    return paint(prism.tokenize(code, grammar), null);
  } catch {
    // A grammar that throws on a malformed file must not take the session with
    // it — the whole point of grading is that the material may be wrong.
    return code;
  }
}

/**
 * Any line that names a file and therefore switches the grammar.
 *
 * Two markers, because two things emit them: `judgedMaterial()` writes
 * `===== path =====` between files, and `referenceCorpus()` writes
 * `----- slug/file -----` between the exemplars it concatenates. The second was
 * unknown here until the corpus started being shown to humans (D-127), at which
 * point four hundred lines of TSX and SCSS arrived as one undifferentiated
 * `plain` block.
 */
const HEADER = /^(?:=====|-----) .+ (?:=====|-----)$/;

/**
 * The grammar a header implies, from the file extension it contains.
 *
 * Matched anywhere in the line rather than by taking the text after the last
 * dot: a header may carry the D-122 authorship annotation
 * (`alert.scss (MODIFIED FIXTURE — …)`), and splitting on the dot yields
 * `scss (MODIFIED FIXTURE — …)`, which is not a grammar. Every modified-fixture
 * section in the suite has been printing unhighlighted for that reason.
 */
const languageOf = (header: string): string =>
  /\.s?css\b/.test(header)
    ? "scss"
    : /\.json\b/.test(header)
      ? "json"
      : /\.md\b/.test(header)
        ? "md"
        : /\.tsx\b/.test(header)
          ? "tsx"
          : /\.jsx\b/.test(header)
            ? "jsx"
            : /\.[cm]?ts\b/.test(header)
              ? "ts"
              : /\.[cm]?js\b/.test(header)
                ? "js"
                : "";

/**
 * Highlight a full `judgedMaterial()` string.
 *
 * The material is `\n\n===== <path> =====\n<body>` repeated, so each body is
 * highlighted with the grammar its own path implies rather than guessing one
 * language for the whole blob — a single item routinely mixes TSX, SCSS and
 * JSON. The headers are painted separately so the file boundaries survive
 * being scrolled past.
 */
export function highlight(material: string): string {
  const parts = material.split(new RegExp(`(${HEADER.source})`, "m"));
  if (parts.length === 1) return material;

  let out = "";
  let language = "";

  for (const part of parts) {
    if (!part) continue;

    if (HEADER.test(part)) {
      language = languageOf(part);
      out += enabled() ? wrap("1;36", part) : part;
    } else {
      out += highlightCode(part, language);
    }
  }

  return out;
}
