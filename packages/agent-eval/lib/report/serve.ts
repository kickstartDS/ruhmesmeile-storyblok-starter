/**
 * Serving a built trial report over HTTP.
 *
 * Screenshotting and browsing both need the static Storybook served rather than
 * opened as `file://`: Storybook's iframe fetches its own JSON index, and
 * `file://` blocks that. This is the smallest server that does the job, and it
 * is deliberately read-only and root-confined — it serves directories full of
 * agent-authored output, so "resolve the path, then check it did not escape"
 * is not paranoia, it is the whole security surface.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface StaticServer {
  origin: string;
  close: () => Promise<void>;
}

/** Serves `root` on an ephemeral port, resolving once it is listening. */
export function serveDirectory(root: string): Promise<StaticServer> {
  const base = resolve(root);

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const decoded = decodeURIComponent(url.pathname);
    const candidate = resolve(join(base, decoded));

    // `resolve` has already collapsed any `..`, so this comparison is the
    // authoritative one: anything outside the root is simply not served.
    if (candidate !== base && !candidate.startsWith(base + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const target =
      existsSync(candidate) && statSync(candidate).isDirectory()
        ? join(candidate, "index.html")
        : candidate;

    if (!existsSync(target)) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": MIME[extname(target)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(target).pipe(response);
  });

  return new Promise((ok, fail) => {
    server.on("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "string" || address === null) {
        fail(new Error("static server did not report a port"));
        return;
      }
      ok({
        origin: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}
