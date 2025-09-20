// sell.ts
import { PrivateApi } from "@deribit/api/privateApi";

import { getTicker } from "./getTicker";

function getResult<T = any>(body: unknown): T {
  return (body as any)?.result as T;
}
export async function sellFuture(instrumentName: string, btcValue: number): Promise<number | undefined> {
  try {
    const ticker = await getTicker(instrumentName);
    const usdValue = Math.max(10, Math.floor(ticker.last_price * btcValue / 10) * 10);
    // Create the API client
    const api = new PrivateApi("https://test.deribit.com/api/v2");

    // (Optional) set username/password if you are using basic auth
    api.username = "vPgITnPm";
    api.password = "AnePRa5g8-_VtbfRsraYS4VVBmbN0WilvMuRr_84sgE";

    // Example: sell 10 contracts of BTC-PERPETUAL as a market order
    const { body } = await api.privateSellGet(
      instrumentName,   // instrument name
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
    console.error("Error placing sell order:", err);
  }
}