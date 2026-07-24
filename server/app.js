import compression from "compression";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { adminAuth } from "./middleware/adminAuth.js";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";

export function createApp() {
  const app = express();
  const root = fileURLToPath(new URL("..", import.meta.url));
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'", "https://connect.facebook.net"],
        "connect-src": ["'self'", "https://www.facebook.com"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "media-src": ["'self'", "blob:", "https:"],
      },
    },
  }));
  app.use(compression());
  app.use(express.json({ limit: "250kb" }));
  app.use("/uploads", express.static(path.resolve(config.uploadDir), { maxAge: "7d" }));
  app.get("/health", async (_req, res) => res.json({ ok: true }));
  app.use("/api", publicRouter);
  app.use("/api/admin", adminAuth, adminRouter);
  app.use(express.static(path.join(root, "dist"), { maxAge: "1h", etag: true }));
  app.get("/admin", adminAuth, (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
  app.use((error, req, res, _next) => {
    console.error(error);
    const status = error.status || (error.code === "23505" ? 409 : 500);
    res.status(status).json({ error: status >= 500 ? "Something went wrong. Please try again." : error.message });
  });
  return app;
}
