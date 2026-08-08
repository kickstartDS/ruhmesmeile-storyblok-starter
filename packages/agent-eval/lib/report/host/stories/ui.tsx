/** Presentational primitives shared by the report pages. */

import { Highlight } from "prism-react-renderer";
import type { ReactNode } from "react";

export function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rp-page">
      <h1 className="rp-title">{title}</h1>
      {subtitle ? <div className="rp-subtitle">{subtitle}</div> : null}
      {children}
    </div>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="rp-section">
      <h2 className="rp-section__heading">{heading}</h2>
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rp-stat">
      <div className="rp-stat__label">{label}</div>
      <div className="rp-stat__value">{value}</div>
    </div>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "pass" | "fail" | "muted";
  children: ReactNode;
}) {
  return <span className={`rp-badge rp-badge--${tone}`}>{children}</span>;
}

/**
 * Prism ships themes as objects of inline styles. This one is empty on purpose:
 * the tokens keep their `token <type>` class names, and the colours live in
 * `report.css` with the rest of the report chrome rather than in a JavaScript
 * object nobody would think to look in.
 */
const NO_INLINE_THEME = { plain: {}, styles: [] };

/** Extensions actually present in a trial workspace, mapped to Prism grammars. */
const GRAMMARS: Record<string, string> = {
  css: "css",
  html: "markup",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  md: "markdown",
  mjs: "javascript",
  scss: "scss",
  ts: "typescript",
  tsx: "tsx",
  yaml: "yaml",
  yml: "yaml",
};

/**
 * Prism's grammar name for a path, or `undefined` when we have none.
 *
 * Unrecognised files render as plain text rather than being forced through the
 * nearest grammar: mis-highlighted source reads as if it contains mistakes,
 * which on this particular site is the one impression the chrome must not give.
 */
export function grammarFor(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext ? GRAMMARS[ext] : undefined;
}

export function Code({
  children,
  language,
}: {
  children: string;
  language?: string;
}) {
  if (!language) return <pre className="rp-code">{children}</pre>;

  return (
    <Highlight code={children} language={language} theme={NO_INLINE_THEME}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre className="rp-code rp-code--lit">
          {tokens.map((line, i) => (
            // Lines are spans rather than blocks, and carry their own newline,
            // so `.rp-code`'s wrapping of long lines survives highlighting.
            <span {...getLineProps({ line })} key={i}>
              {line.map((token, k) => (
                <span {...getTokenProps({ token })} key={k} />
              ))}
              {"\n"}
            </span>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

export function Note({
  tone = "plain",
  children,
}: {
  tone?: "plain" | "warn";
  children: ReactNode;
}) {
  return (
    <div className={tone === "warn" ? "rp-note rp-note--warn" : "rp-note"}>
      {children}
    </div>
  );
}

export const usd = (value: number): string => `$${value.toFixed(2)}`;

export const num = (value: number): string =>
  value.toLocaleString("en-US", { maximumFractionDigits: 0 });

export const seconds = (value: number): string => {
  const total = Math.round(value);
  const mins = Math.floor(total / 60);
  return mins
    ? `${mins}m ${String(total % 60).padStart(2, "0")}s`
    : `${total}s`;
};
