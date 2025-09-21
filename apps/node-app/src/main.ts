import "module-alias/register";
import "dotenv/config";
import { createServer } from "./http/server";
import { scheduleNextMinuteOverlap } from "./index";
import { startSlackSocket } from "./slack/socketApp";
import { parseBool } from "./utils";


let schedulerStarted = false;

export async function startScheduler(blockOrders: boolean) {
  if (schedulerStarted) return;            // 👈 prevents accidental double start
  schedulerStarted = true;
  scheduleNextMinuteOverlap(blockOrders);
}

async function start() {
  const port = Number(process.env.PORT || 8080);
  const app = createServer();
  const server = app.listen(port, () => {
    console.log(`HTTP server listening on :${port}`);
  });

  const blockOrders = parseBool(process.env.BLOCK_ORDERS);
  if (blockOrders) console.log("Orders are blocked");

  if (!blockOrders) {
    // Start Slack (no HTTPS needed)
    startSlackSocket().catch(err => console.error("Slack socket error:", err));
  }

  startScheduler(blockOrders).catch(err =>
    console.error("Deribit cycle failed:", err)
  );

  // graceful shutdown
  const shutdown = async () => {
    try { await new Promise<void>(res => server.close(() => res())); } catch { }
    // your index.ts already calls closePool on signals; that’s fine
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();
