import express from "express";
import { routes } from "./routes";

export function createServer() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" })); // parse JSON bodies

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.use("/api", routes);

  // consistent 404
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // basic error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("HTTP error:", err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}

// If invoked directly, start listening
if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  const app = createServer();
  app.listen(port, () => console.log(`HTTP server listening on :${port}`));
}
