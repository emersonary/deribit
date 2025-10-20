// apps/node-app/src/db/statusInstrumentsRepo.ts
import type { PoolClient, QueryResultRow } from "pg";
import { query } from "../db"; // import your generic query helper

export interface StatusInstrument {
  adj_enabled: boolean
  adj_edge: number
}

export interface StatusInstruments {
  instruments: Record<string, StatusInstrument> | null;
}

export const statusInstruments: StatusInstruments = {
  instruments: null
};

/** DB row shape for `status_instruments`. Keep in sync with schema. */
export interface StatusInstrumentRow extends QueryResultRow {
  symbol: string;
  adj_enabled: boolean;
  adj_edge: number; // stored as float in DB
}

/**
 * Load all status instruments from DB and return a Record keyed by symbol.
 */
export async function loadStatusInstrumentsFromDB(
  client?: PoolClient
): Promise<Record<string, StatusInstrument>> {
  const rows = await query<StatusInstrumentRow>(
    `
    SELECT
      symbol,
      adj_enabled,
      adj_edge
    FROM status_instruments
    ORDER BY symbol
    `,
    [],
    client
  );
  const out: Record<string, StatusInstrument> = {};
  for (const r of rows) {
    out[r.symbol] = {
      adj_enabled: r.adj_enabled,
      adj_edge: Number(r.adj_edge), // ensure numeric (float) in TS
    };
  }
  return out;
}

/**
 * Optional: upsert a single instrument (handy for admin tools or sync jobs).
 */
export async function upsertStatusInstrument(
  symbol: string,
  value: StatusInstrument,
  client?: PoolClient
): Promise<void> {
  await query(
    `
    INSERT INTO status_instruments (symbol, adj_enabled, adj_edge)
    VALUES ($1, $2, $3)
    ON CONFLICT (symbol)
    DO UPDATE SET adj_enabled = EXCLUDED.adj_enabled,
                  adj_edge    = EXCLUDED.adj_edge
    `,
    [symbol, value.adj_enabled, value.adj_edge],
    client
  );

  // Keep in-memory cache in sync
  if (statusInstruments.instruments === null) {
    statusInstruments.instruments = {};
  }
  statusInstruments.instruments[symbol] = { ...value };
}

export async function getStatusInstruments() {
  if (statusInstruments.instruments === null) {
    statusInstruments.instruments = await loadStatusInstrumentsFromDB();
  }
  return statusInstruments;
}