// index.ts
import { getTicker } from "./api/getTicker";
import { getAccountSummaries } from "./api/getAccountSummaries";
import { buyFutureBTC } from "./api/buy";
import { sellFutureBTC } from "./api/sell";
import { query, closePool } from "./db";
import { setTimeout as sleep } from "node:timers/promises";
import { sendSlackMessage } from "./slack";


function scheduleNextMinuteOverlap() {
  const now = Date.now();
  const next = Math.ceil(now / 60000) * 60000;
  const delay = next - now;
  setTimeout(() => {
    deribitVerificationCycle().catch(console.error);
    scheduleNextMinuteOverlap();
  }, delay);
}

async function deribitVerificationCycle() {
  try {
    const now = new Date();
    // Replace getTicker() with getAccountSummaries()
    const [summaries, ticker] = await Promise.all([
      getAccountSummaries(true),
      getTicker("BTC-PERPETUAL")
    ]);

    // Find the BTC summary
    const btcSummary = summaries.summaries.find(
      (item: any) => item.currency === "BTC"
    );

    if (btcSummary) {
      // Insert snapshot into DB
      const result = await query(
        "SELECT func_upsert_account_snapshot($1, $2,$3)",
        [btcSummary, ticker.last_price, now]
      );
      console.log("Snapshot ID:", result.rows[0].func_upsert_account_snapshot, now, "delta:", btcSummary.delta_total, "btc:", ticker.last_price);
      if (btcSummary.delta_total < -0.30) {
        const orderId = await buyFutureBTC(Math.abs(btcSummary.delta_total))
        sendSlackMessage("Buy order", "BTC-PERPETUAL", btcSummary.delta_total, btcSummary.equity, ticker.last_price);
        console.log("Buy Order ID:", orderId)
      }
      if (btcSummary.delta_total > 0.30) {
        const orderId = await sellFutureBTC(Math.abs(btcSummary.delta_total))
        sendSlackMessage("Sell order", "BTC-PERPETUAL", btcSummary.delta_total, btcSummary.equity, ticker.last_price);
        console.log("Sell Order ID:", orderId)
      }
    } else {
      console.log("No BTC summary found.");
    }
    await sleep(5000);
  } catch (err) {
    console.error(err);
  }
}

// graceful shutdown
process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});

function main() {
  console.log("Initializing application");
  scheduleNextMinuteOverlap();
}

main();
