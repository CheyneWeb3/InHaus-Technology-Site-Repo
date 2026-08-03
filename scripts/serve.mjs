import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const root = path.resolve(projectRoot, valueAfter("--root", "."));
const port = Number(process.env.PORT || valueAfter("--port", "49205"));
const host = process.env.HOST || "0.0.0.0";
const publicDir = path.join(root, "public");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${port}`);
  process.exit(1);
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function safePath(base, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath.split("?")[0]);
  } catch {
    return null;
  }

  const normalized = path.normalize(decoded).replace(/^([/\\])+/, "");
  const candidate = path.resolve(base, normalized || "index.html");
  const relative = path.relative(base, candidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return candidate;
}

async function existingFile(candidate) {
  if (!candidate) return null;
  try {
    const fileStat = await stat(candidate);
    return fileStat.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(
      request.url || "/",
      `http://${request.headers.host || "localhost"}`
    ).pathname;

    let filePath = await existingFile(safePath(root, pathname));

    if (!filePath) {
      try {
        await access(publicDir);
        filePath = await existingFile(safePath(publicDir, pathname));
      } catch {
        // Production builds place public files directly in dist.
      }
    }

    if (!filePath && !path.extname(pathname)) {
      filePath = await existingFile(path.join(root, "index.html"));
    }

    if (!filePath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found\n");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const headers = {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": extension === ".json" || root === projectRoot
        ? "no-store"
        : "public, max-age=3600"
    };

    response.writeHead(200, headers);
    createReadStream(filePath).pipe(response);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error\n");
  }
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
    console.error(`Close the other server or run: set PORT=49208 && npm run dev`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  console.log("");
  console.log("InHaus Technologies site is running");
  console.log(`Open: http://localhost:${port}`);
  console.log(`Serving: ${root}`);
  console.log("Press Ctrl+C to stop.");
  console.log("");
});
