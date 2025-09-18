import { Pool, PoolClient, QueryResultRow } from "pg";
import { config } from "./config";

const pool = config.databaseUrl
  ? new Pool({
    connectionString: config.databaseUrl,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  })
  : new Pool({
    host: config.host,
    port: config.port ?? 5432,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  });

pool.on("error", (err) => {
  console.error("Unexpected PG pool error", err);
});

/**
 * Run a query and return rows (T[]).
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client?: PoolClient
): Promise<T[]> {
  const runner: { query: (q: string, p?: unknown[]) => Promise<{ rows: T[] }> } =
    client ?? (pool as unknown as any);

  try {
    const res = await runner.query(sql, params);
    return res.rows as T[];
  } catch (err) {
    console.error("PG query error:", { sql, params, err });
    throw err;
  }
}

/**
 * Run a function inside a transaction.
 * Use the provided client with `query(..., ..., client)` if you need multiple statements.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}
