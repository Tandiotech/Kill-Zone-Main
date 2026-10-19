import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // index:false — "/" must reach the catch-all below rather than being
  // auto-served as index.html, since the command-center UI (cockpit.html)
  // is what actually lives at the root.
  app.use(express.static(distPath, { index: false }));

  // fall through to the right SPA shell if the file doesn't exist.
  // req.path/req.url are rebased to "/" here — app.use(path, ...) mounts the
  // handler at the matched prefix, and "/{*path}" always matches the whole
  // thing — so the real request path has to come from req.originalUrl.
  app.use("/{*path}", (req, res) => {
    const reqPath = req.originalUrl.split(/[?#]/)[0];
    const page = reqPath === "/" ? "cockpit.html" : "index.html";
    res.sendFile(path.resolve(distPath, page));
  });
}
