// buy.ts
import { PrivateApi } from "@deribit/api/privateApi";

import { getTicker } from "./getTicker";
import 'dotenv/config';

function getResult<T = any>(body: unknown): T {
  return (body as any)?.result as T;
}

export async function buyFuture(instrumentaName: string, btcValue: number): Promise<number | undefined> {
  try {
    const HOST = process.env.DERIBIT_HOST ?? "test.deribit.com";
    const BASE = `https://${HOST}/api/v2`;
    const CLIENT_ID = process.env.DERIBIT_CLIENT_ID!;
    const CLIENT_SECRET = process.env.DERIBIT_CLIENT_SECRET!

    const ticker = await getTicker(instrumentaName);
    const usdValue = Math.max(10, Math.floor(ticker.last_price * btcValue / 10) * 10);
    // Create the API client
    const api = new PrivateApi(BASE);

    // (Optional) set username/password if you are using basic auth
    api.username = CLIENT_ID;
    api.password = CLIENT_SECRET;

    // Example: Buy 10 contracts of BTC-PERPETUAL as a market order
    const { body } = await api.privateBuyGet(
      instrumentaName,   // instrument name
      usdValue,                // amount
      "market",          // order type: limit | stop_limit | market | stop_market
      "my-order-label"   // optional label
      // You can also pass: price, timeInForce, postOnly, reduceOnly, etc.
    );

    const result = getResult(body);
    const orderId =
      result.order?.order_id ??
      result.order_id ??
      result.trades?.[0]?.order_id;

    return orderId;
  } catch (err) {
    console.error("Error placing buy order:", err);
  }
}