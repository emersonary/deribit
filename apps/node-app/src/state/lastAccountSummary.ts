// apps/node-app/src/state/lastAccountSummary.ts
import { EventEmitter } from "events";
import { LastAccountSnapshot } from "@goldie/models";

// Narrow if you like: type Currency = "BTC" | "ETH";
export type Currency = string;

/**
 * In-memory per-currency store for the latest account summary.
 * Because Node caches modules, this is shared across the whole app.
 */

const emitter = new EventEmitter();

// Per-currency snapshots
const store = new Map<Currency, Readonly<LastAccountSnapshot>>();

function buildNext(
  prev: Readonly<LastAccountSnapshot> | undefined,
  partial: Partial<Pick<LastAccountSnapshot, "last_price" | "equity_usd" | "delta_total" | "equity" | "diff">>
): Readonly<LastAccountSnapshot> {
  return Object.freeze({
    last_price: partial.last_price ?? prev?.last_price ?? null,
    equity_usd: partial.equity_usd ?? prev?.equity_usd ?? null,
    delta_total: partial.delta_total ?? prev?.delta_total ?? null,
    equity: partial.equity ?? prev?.equity ?? null,
    diff: partial.diff ?? prev?.diff ?? null,
    updated_at: Date.now(),
  });
}

/** Upsert and emit change for a currency. */
export function setLastAccountSummary(
  currency: Currency,
  partial: Partial<Pick<LastAccountSnapshot, "last_price" | "equity_usd" | "delta_total" | "equity" | "diff">>
): Readonly<LastAccountSnapshot> {
  const prev = store.get(currency);
  const next = buildNext(prev, partial);
  store.set(currency, next);

  // Emit per-currency and "any" change events
  emitter.emit(`change:${currency}`, next);
  emitter.emit("change", currency, next);
  return next;
}

/** Get the latest snapshot for a currency (or null if none). */
export function getLastAccountSummary(currency: Currency): Readonly<LastAccountSnapshot> | null {
  return store.get(currency) ?? null;
}

/** Get shallow copy of all current snapshots keyed by currency. */
export function getAllLastAccountSummaries(): Record<Currency, Readonly<LastAccountSnapshot>> {
  const out: Record<string, Readonly<LastAccountSnapshot>> = {};
  for (const [k, v] of store.entries()) out[k] = v;
  return out;
}

/** Subscribe to changes for a specific currency. Returns an unsubscribe. */
export function onLastAccountSummaryChange(
  currency: Currency,
  listener: (snap: Readonly<LastAccountSnapshot>) => void
): () => void {
  const event = `change:${currency}`;
  emitter.on(event, listener);
  return () => emitter.off(event, listener);
}

/** Subscribe to changes for any currency. Returns an unsubscribe. */
export function onAnyLastAccountSummaryChange(
  listener: (currency: Currency, snap: Readonly<LastAccountSnapshot>) => void
): () => void {
  emitter.on("change", listener);
  return () => emitter.off("change", listener);
}

/** Optional: reset (useful in tests) */
export function resetLastAccountSummary(): void {
  store.clear();
}
