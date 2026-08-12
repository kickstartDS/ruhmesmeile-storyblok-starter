/**
 * 2.11 — serving the results tree.
 *
 * The results are agent-authored HTML, JavaScript and CSS: sixty static
 * Storybooks, each one containing whatever a model decided to write. That makes
 * this a slightly unusual static site, and two of the choices below follow
 * directly from it.
 *
 * It is gated (D7). Not because the contents are secret, but because the tree
 * carries full transcripts — prompts, tool calls, reasoning — and publishing
 * those to an open URL is a decision nobody has taken. The gate is the same
 * shared JWT the other four services use, so there is one secret to rotate and
 * one script that issues tokens.
 *
 * And it is served with a strict `Content-Security-Policy` confining it to its
 * own origin. The reports are meant to run agent-written code; that is the
 * feature. Nothing may reach a third party, so reviewing a result is never an
 * act of trust in the thing being reviewed.
 *
 * Auth degrades gracefully: with no `MCP_JWT_SECRET` set the site is open,
 * matching every other service in the repo so local use needs no setup.
 *
 * Runs under plain `node` — Node 24 strips types natively, so the container
 * needs none of this package's devDependencies.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isAuthEnabled, verifyToken } from "@kickstartds/shared-auth";
import cookieParser from "cookie-parser";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

// Explicit extension: node strips the types, it does not resolve for us.
import { mountCalibration } from "./calibrate.ts";

const RESULTS_DIR =
  process.env.RESULTS_DIR ??
  join(dirname(fileURLToPath(import.meta.url)), "..", "results");

const PORT = Number(process.env.PORT ?? 8080);
const COOKIE = "auth_token";

/**
 * Reports execute agent-authored scripts, so they are allowed to run — and
 * allowed to reach nothing but this origin. `'unsafe-inline'` and
 * `'unsafe-eval'` are required by Storybook's own bundle.
 *
 * `connect-src` and `form-action` were both `'none'` first, which is the
 * stricter and wronger answer: Storybook's manager fetches `index.json` to
 * discover its stories, so every report failed to load, and the login form
 * below could not post to its own endpoint. Neither showed up in testing
 * because both were exercised with curl, which does not enforce CSP.
 *
 * `'self'` keeps the property that matters. The threat is agent-written code
 * calling out to somewhere we do not control; a same-origin request reaches a
 * static file server with one POST route that only exchanges a token the caller
 * already holds.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
].join("; ");

const LOGIN_PAGE = (error?: string): string => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>agent-eval results — sign in</title>
<style>
  :root { color-scheme: light dark; }
  body { display: grid; place-items: center; min-height: 100vh; margin: 0;
         font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
  form { width: min(30rem, 90vw); display: grid; gap: .75rem; }
  h1 { font-size: 1.2rem; margin: 0; }
  p { margin: 0; opacity: .7; }
  textarea { font: 13px ui-monospace, monospace; padding: .6rem; min-height: 7rem;
             border-radius: 6px; border: 1px solid rgba(128,128,128,.5); }
  button { padding: .6rem 1rem; border-radius: 6px; border: 0; font: inherit;
           background: #2563eb; color: #fff; cursor: pointer; }
  .err { color: #dc2626; }
</style>
<form method="post" action="/login">
  <h1>agent-eval results</h1>
  <p>Paste the access token you were issued.</p>
  ${error ? `<p class="err">${error}</p>` : ""}
  <textarea name="token" required autofocus spellcheck="false"
            aria-label="Access token"></textarea>
  <button type="submit">Sign in</button>
</form>
</html>
`;

const app = express();

app.disable("x-powered-by");
app.use(cookieParser());
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(express.json({ limit: "16kb" }));

app.use((_request, response, next) => {
  response.setHeader("Content-Security-Policy", CSP);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// Unauthenticated: the orchestrator needs to know the container is alive.
app.get("/health", (_request, response) => {
  response.json({ ok: true, results: existsSync(RESULTS_DIR) });
});

app.get("/login", (_request, response) => {
  response.type("html").send(LOGIN_PAGE());
});

app.post("/login", (request, response) => {
  const token = String((request.body as { token?: string }).token ?? "").trim();
  const user = token ? verifyToken(token) : null;

  if (!user) {
    response
      .status(401)
      .type("html")
      .send(LOGIN_PAGE("That token was not accepted."));
    return;
  }

  response.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: Math.max(0, (user.exp - Math.floor(Date.now() / 1000)) * 1000),
  });
  response.redirect("/");
});

app.use((request: Request, response: Response, next: NextFunction) => {
  if (!isAuthEnabled()) {
    next();
    return;
  }

  const cookies = (request as Request & { cookies?: Record<string, string> })
    .cookies;
  if (cookies?.[COOKIE] && verifyToken(cookies[COOKIE])) {
    next();
    return;
  }

  // A stale cookie is indistinguishable from none, and leaving it set means the
  // next request fails the same way for a reason the user cannot see.
  response.clearCookie(COOKIE);
  response.status(401).type("html").send(LOGIN_PAGE());
});

// Behind the gate, ahead of the static tree: `/calibrate` is a route, and the
// results directory must never get the chance to shadow it with a file.
mountCalibration(app);

app.use(
  express.static(RESULTS_DIR, { index: "index.html", dotfiles: "ignore" }),
);

app.listen(PORT, () => {
  console.log(
    `agent-eval results on :${PORT} — ${RESULTS_DIR}` +
      `${isAuthEnabled() ? "" : " (auth disabled: no MCP_JWT_SECRET)"}`,
  );
});
