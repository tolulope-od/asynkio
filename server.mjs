#!/usr/bin/env node
/**
 * Minimal static server for the Asynk IO.
 *
 * Extras over `python3 -m http.server`:
 *   - clean URLs: /login serves login.html, /login/ serves login/index.html
 *   - correct MIME types for .woff2, .mjs, .svg, .webp
 *   - SPA-free 404 page
 *
 * Usage: node server.mjs [port]
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, ".");
const PORT = Number(process.argv[2] || process.env.PORT || 4321);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".m4s": "video/iso.segment",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

/**
 * Server-only endpoints that a static mirror cannot implement.
 *
 * The client posts to these with axios (no baseURL), so they resolve against
 * whichever origin serves the clone — the original site's API is never
 * contacted. `/api/stripe/checkout/create` is answered with the exact shape
 * the real handler consumes (`{ url }`), so the button's own code path leads
 * somewhere informative instead of hanging on a 404.
 */
const API_ROUTES = {
  "/api/stripe/checkout/create": (res) =>
    sendJson(res, 200, { url: "/clone-notice.html" }),
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

/** Resolve a URL pathname to a file on disk, honouring clean URLs. */
function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0]);
  const safe = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const candidates = [];

  const direct = join(ROOT, safe);
  if (!direct.startsWith(ROOT)) return null;

  candidates.push(direct);
  if (!extname(safe)) {
    candidates.push(`${direct}.html`);
    candidates.push(join(direct, "index.html"));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const server = createServer((req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;

  if (pathname.startsWith("/api/")) {
    const handler = API_ROUTES[pathname];
    if (handler && req.method === "POST") return handler(res);
    return sendJson(res, 501, {
      error: "not_implemented",
      message:
        "This endpoint is server-side only and is not part of the static clone.",
      path: pathname,
    });
  }

  const file = resolveFile(req.url || "/");

  if (!file) {
    const notFound = join(ROOT, "404.html");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    if (existsSync(notFound)) return createReadStream(notFound).pipe(res);
    return res.end("<h1>404 — Not found</h1>");
  }

  const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
  const ext = extname(file).toLowerCase();

  // Only fonts are safe to cache "forever": their bytes never change, and the
  // filenames are not content-hashed, so anything editable (CSS, JS, HTML, the
  // sprite) must revalidate on every request. Serving a stale stylesheet
  // against fresh markup silently breaks the whole layout.
  const immutable = [".woff", ".woff2", ".ttf", ".otf"].includes(ext);
  const etag = `"${createHash("sha1")
    .update(readFileSync(file))
    .digest("hex")
    .slice(0, 20)}"`;

  const headers = {
    "content-type": type,
    etag,
    "cache-control": immutable
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  };

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  res.writeHead(200, { ...headers, "content-length": statSync(file).size });
  createReadStream(file).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Asynk IO → http://127.0.0.1:${PORT}/`);
  console.log(`Serving ${ROOT}`);
});
