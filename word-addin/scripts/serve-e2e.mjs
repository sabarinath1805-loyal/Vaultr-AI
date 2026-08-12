import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.cwd(), "dist");
const port = Number(process.env.E2E_PORT ?? 3100);
const host = process.env.E2E_HOST ?? "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = normalize(join(root, pathname));
  return candidate === root || candidate.startsWith(root + sep) || candidate.startsWith(`${root}/`)
    ? candidate
    : null;
}

const server = createServer(async (request, response) => {
  try {
    const filePath = safePath(request.url ?? "/");
    if (!filePath) {
      response.writeHead(400).end("Bad request");
      return;
    }

    const info = await stat(filePath);
    if (!info.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

const shutdown = () => server.close(() => process.exit(0));
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

server.listen(port, host, () => {
  console.log(`E2E server listening at http://${host}:${port}`);
});
