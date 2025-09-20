// apps/node-app/src/http/server.ts
import express from "express";
import { routes } from "./routes";
import { slackRouter, rawBodySaver } from "./slack"; // ⬅️ we'll create this

export function createServer() {
  const app = express();
  app.disable("x-powered-by");

  // Keep raw body for Slack signature verification (works for urlencoded & json)
  app.use(express.urlencoded({ extended: true, verify: rawBodySaver }));
  app.use(express.json({ limit: "256kb", verify: rawBodySaver }));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // Slack endpoints (no JWT; use Slack signature instead)
  app.use("/slack", slackRouter);

  // Your normal API (JWT-guarded)
  app.use("/api", routes);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("HTTP error:", err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  createServer().listen(port, () =>
    console.log(`HTTP server listening on :${port}`)
  );
}
