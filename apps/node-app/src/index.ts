import "module-alias/register";
import 'dotenv/config';
import { setTimeout as sleep } from "node:timers/promises";

import { getTicker } from "./api/getTicker";
import { getAccountSummaries } from "./api/getAccountSummaries";
import { buyFuture } from "./api/buy";
import { sellFuture } from "./api/sell";
import { query, closePool } from "./db";
import { sendSlackMessage } from "./slack";
import { setLastAccountSummary } from "./state/lastAccountSummary";
import { formatCurrency } from "./utils";
import { getStatusInstruments } from "./state/status";

// --- types for safer reads ---
type UpsertRow = { func_upsert_account_snapshot?: number };
const CURRENCIES = ["BTC", "ETH"] as const;
type Currency = typeof CURRENCIES[number];
const INSTRUMENT = (c: Currency) => `${c}-PERPETUAL` as const;
type Ticker = { last_price?: number };
type AccountSummary = { currency: string; delta_total: number; equity: number };

// Run a task exactly at the start of every minute, even if the previous one overlaps.
export async function scheduleNextMinuteOverlap(blockOrders: boolean) {
  const now = Date.now();
  const interval = 30_000
  const next = Math.ceil(now / interval) * interval;
  const delay = next - now;
  setTimeout(() => {
    deribitVerificationCycle(blockOrders).catch((e) => console.error("cycle error:", e));
    scheduleNextMinuteOverlap(blockOrders);
  }, delay);
}

function toLocalISOString(d: Date = new Date()): string {
  const tz = d.getTimezoneOffset();                 // minutes (UTC - local)
  const local = new Date(d.getTime() - tz * 60000); // shift to local
  return local.toISOString().slice(0, -1);          // drop trailing 'Z'
}

async function deribitVerificationCycle(blockOrders: boolean) {
  try {
    const now = new Date();

    // Pull summaries + all tickers in parallel
    const [summariesResp, tickersArr] = await Promise.all([
      getAccountSummaries(true),
      Promise.all(CURRENCIES.map((c) => getTicker(INSTRUMENT(c)))),
    ]);

    const summaries: AccountSummary[] = summariesResp?.summaries ?? [];

    // Build a map currency -> ticker
    const tickerByCurrency = new Map<Currency, Ticker>();
    CURRENCIES.forEach((c, i) => tickerByCurrency.set(c, tickersArr[i] ?? {}));

    for (const currency of CURRENCIES) {
      const instrument = INSTRUMENT(currency);
      const ticker = tickerByCurrency.get(currency) ?? {};

      if (!Number.isFinite(ticker.last_price)) {
        console.warn(`No valid last_price for ${instrument}:`, ticker);
        continue;
      }

      // Find summary for this currency
      const summary = summaries.find((s) => s.currency === currency);
      if (!summary) {
        console.log(`No ${currency} summary found.`);
        continue;
      }

      // Same calculations as before, now per-currency
      const usdEquity = (ticker.last_price ?? 0) * summary.equity;
      const diff = summary.delta_total + summary.equity;

      // (Optional) this overwrites the "last" snapshot; if you want per-currency state,
      // make setLastAccountSummary accept a currency or store a map.
      setLastAccountSummary(instrument, {
        last_price: ticker.last_price,
        equity_usd: usdEquity,
        delta_total: summary.delta_total,
        equity: summary.equity,
        diff: diff,
      });

      // Upsert snapshot (jsonb, last_price numeric, timestamp)
      const upsertSql =
        "SELECT func_upsert_account_snapshot($1::jsonb, $2::numeric, $3::timestamptz) AS func_upsert_account_snapshot";

      const rows = await query<UpsertRow>(upsertSql, [
        JSON.stringify(summary),
        ticker.last_price!,
        now,
      ]);

      console.log(
        `[${currency}] SID:`,
        rows[0].func_upsert_account_snapshot,
        "usd_equity:",
        formatCurrency(usdEquity),
        "delta:",
        summary.delta_total?.toFixed(2),
        "diff:",
        diff.toFixed(2)
      );

      const allStatuses = await getStatusInstruments();
      const rawStatus = allStatuses.instruments?.[instrument] ?? null;
      const status = rawStatus ?? { adj_enabled: false, adj_edge: 0 };

      if (!blockOrders && status.adj_enabled) {

        // Hedge logic (unchanged), per-currency + per-instrument
        if (diff < -status.adj_edge) {
          // If you keep the old helpers, change this to:
          // if (currency === "BTC") { const orderId = await buyFutureBTC(Math.abs(diff)); ... }
          const orderId = await buyFuture(instrument, Math.abs(diff));
          await sendSlackMessage(
            "Buy order",
            orderId ?? 0,
            instrument,
            Math.abs(diff),
            summary.delta_total,
            summary.equity,
            ticker.last_price!
          );
          console.log(`[${currency}] Buy Order ID:`, orderId, "qty:", Math.abs(diff));
          await sleep(5_000);
        } else if (diff > +status.adj_edge) {
          // If you keep the old helpers, change this to:
          // if (currency === "BTC") { const orderId = await sellFutureBTC(Math.abs(diff)); ... }
          const orderId = await sellFuture(instrument, Math.abs(diff));
          await sendSlackMessage(
            "Sell order",
            orderId ?? 0,
            instrument,
            Math.abs(diff),
            summary.delta_total,
            summary.equity,
            ticker.last_price!
          );
          console.log(`[${currency}] Sell Order ID:`, orderId, "qty:", Math.abs(diff));
          await sleep(5_000);
        }
      }
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

function main() {
  console.log("Initializing application");
}

main();
