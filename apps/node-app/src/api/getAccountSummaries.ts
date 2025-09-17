// getAccountSummaries.ts
import request = require("request");
import { getAuthHeader } from "./auth";

/**
 * Calls private/get_account_summaries (HTTP JSON-RPC) and returns result.
 * Token is cached + auto-refreshed by auth.ts
 */
export async function getAccountSummaries(extended = true): Promise<any> {
  const HOST = process.env.DERIBIT_HOST ?? "test.deribit.com";
  const BASE = `https://${HOST}/api/v2`;
  const headers = await getAuthHeader();
  const reqOptions: request.Options = {
    method: "POST",
    uri: `${BASE}/private/get_account_summaries`,
    headers,
    json: true,
    body: {
      jsonrpc: "2.0",
      id: 1,
      method: "private/get_account_summaries",
      params: { extended }
    }
  };

  return new Promise((resolve, reject) => {
    request(reqOptions, (err, resp, body) => {
      if (err) return reject(err);
      if (!resp || resp.statusCode! < 200 || resp.statusCode! > 299) {
        return reject(new Error(`HTTP ${resp?.statusCode}: ${JSON.stringify(body)}`));
      }
      if (body?.error) {
        return reject(new Error(`${body.error.code}: ${body.error.message}`));
      }
      resolve(body?.result);
    });
  });
}
