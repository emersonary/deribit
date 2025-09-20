// apps/node-app/src/state/lastAccountSummary.ts
import { EventEmitter } from "events";
import { LastAccountSnapshot } from "@goldie/models";

/**
 * Simple in-memory singleton store for the latest account summary.
 * Because Node caches modules, this is shared across the whole app.
 */

const emitter = new EventEmitter();

// Start empty; we'll set it after first successful fetch.
let current: LastAccountSnapshot | null = null;

export function setLastAccountSummary(
  partial: Partial<Pick<LastAccountSnapshot, "last_price" | "equity_usd">>
): Readonly<LastAccountSnapshot> {
  const next: LastAccountSnapshot = Object.freeze({
    last_price: partial.last_price ?? current?.last_price ?? null,
    equity_usd: partial.equity_usd ?? current?.equity_usd ?? null,
    updated_at: Date.now(),
  });

  current = next;
  emitter.emit("change", next);
  return next;
}

export function getLastAccountSummary(): Readonly<LastAccountSnapshot> | null {
  return current;
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function onLastAccountSummaryChange(
  listener: (snap: Readonly<LastAccountSnapshot>) => void
): () => void {
  emitter.on("change", listener);
  return () => emitter.off("change", listener);
}

/** Optional: reset (useful in tests) */
export function resetLastAccountSummary(): void {
  current = null;
}
