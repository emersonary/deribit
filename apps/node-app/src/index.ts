import "module-alias/register";
import 'dotenv/config';
import { setTimeout as sleep } from "node:timers/promises";

import { getTicker } from "./api/getTicker";
import { getAccountSummaries } from "./api/getAccountSummaries";
import { buyFutureBTC } from "./api/buy";
import { sellFutureBTC } from "./api/sell";
import { query, closePool } from "./db";
import { sendSlackMessage } from "./slack";
import { setLastAccountSummary } from "./state/lastAccountSummary";

// --- types for safer reads ---
type UpsertRow = { func_upsert_account_snapshot?: number };
type Ticker = { last_price?: number };
type AccountSummary = { currency: string; delta_total: number; equity: number };

// Run a task exactly at the start of every minute, even if the previous one overlaps.
export async function scheduleNextMinuteOverlap(blockOrders: boolean) {
  const now = Date.now();
  const next = Math.ceil(now / 60_000) * 60_000;
  const delay = next - now;
  setTimeout(() => {
    deribitVerificationCycle(blockOrders).catch((e) => console.error("cycle error:", e));
    scheduleNextMinuteOverlap(blockOrders);
  }, delay);
}

const formatCurrency = (n?: number, locale: string = 'pt-BR') =>
  n == null
    ? '' // or '—'
    : new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(n);

function toLocalISOString(d: Date = new Date()): string {
  const tz = d.getTimezoneOffset();                 // minutes (UTC - local)
  const local = new Date(d.getTime() - tz * 60000); // shift to local
  return local.toISOString().slice(0, -1);          // drop trailing 'Z'
}

async function deribitVerificationCycle(blockOrders: boolean) {
  try {
    const now = new Date();

    // Pull data in parallel
    const [summariesResp, tickerResp] = await Promise.all([
      getAccountSummaries(true),
      getTicker("BTC-PERPETUAL"),
    ]);

    const summaries: AccountSummary[] = summariesResp?.summaries ?? [];
    const ticker: Ticker = tickerResp ?? {};

    if (!Number.isFinite(ticker.last_price)) {
      console.warn("No valid last_price in ticker:", tickerResp);
      return;
    }

    // Find BTC summary
    const btcSummary = summaries.find((s) => s.currency === "BTC");
    if (!btcSummary) {
      console.log("No BTC summary found.");
      return;
    }

    const usdEquity = (ticker.last_price ?? 0) * btcSummary.equity;

    setLastAccountSummary({
      last_price: ticker.last_price,
      equity_usd: usdEquity,
      delta_total: btcSummary.delta_total
    });

    const upsertSql =
      "SELECT func_upsert_account_snapshot($1::jsonb, $2::numeric, $3::timestamptz) AS func_upsert_account_snapshot";

    const rows = await query<UpsertRow>(upsertSql, [
      JSON.stringify(btcSummary),   // 👈 pass JSON text if function takes json/jsonb
      ticker.last_price!,
      now,
    ]);


    console.log("Snapshot ID:", rows[0].func_upsert_account_snapshot,
      "usd_equity:",
      formatCurrency(usdEquity),
      "delta:",
      btcSummary.delta_total?.toFixed(5),
      "price:",
      formatCurrency(ticker.last_price));

    if (!blockOrders) {

      // Hedge logic
      if (btcSummary.delta_total < -btcSummary.equity - 0.3) {
        const orderId = await buyFutureBTC(Math.abs(btcSummary.delta_total));
        await sendSlackMessage(
          "Buy order",
          "BTC-PERPETUAL",
          btcSummary.delta_total,
          btcSummary.delta_total + btcSummary.equity,
          ticker.last_price!
        );
        console.log("Buy Order ID:", orderId);
      } else if (btcSummary.delta_total > -btcSummary.equity + 0.3) {
        const orderId = await sellFutureBTC(Math.abs(btcSummary.delta_total));
        await sendSlackMessage(
          "Sell order",
          "BTC-PERPETUAL",
          btcSummary.delta_total,
          btcSummary.delta_total + btcSummary.equity,
          ticker.last_price!
        );
        console.log("Sell Order ID:", orderId);
      }

      await sleep(5_000);
    }
  } catch (err) {
    console.error("deribitVerificationCycle exception:", err);
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

function parseBool(envVar?: string): boolean {
  return envVar?.toLowerCase() === "true";
}
function main() {
  console.log("Initializing application");
  // const blockOrders = parseBool(process.env["BLOCK_ORDERS"])
  // if (blockOrders) {
  //   console.log("Orders are blocked");
  // }
  //scheduleNextMinuteOverlap(blockOrders);
}

main();
