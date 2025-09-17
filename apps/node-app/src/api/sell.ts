// sell.ts
import { PrivateApi } from "../../../../external/deribit-api-clients/typescript-node/api/privateApi";
import { getTicker } from "./getTicker";

export async function sellFutureBTC(btcValue: number): Promise<number> {
  try {
    const ticker = await getTicker("BTC-PERPETUAL");
    const usdValue = Math.max(10, Math.floor(ticker.last_price * btcValue / 10) * 10);
    // Create the API client
    const api = new PrivateApi("https://test.deribit.com/api/v2");

    // (Optional) set username/password if you are using basic auth
    api.username = "vPgITnPm";
    api.password = "AnePRa5g8-_VtbfRsraYS4VVBmbN0WilvMuRr_84sgE";

    // Example: sell 10 contracts of BTC-PERPETUAL as a market order
    const { body } = await api.privateSellGet(
      "BTC-PERPETUAL",   // instrument name
      usdValue,                // amount
      "market",          // order type: limit | stop_limit | market | stop_market
      "my-order-label"   // optional label
      // You can also pass: price, timeInForce, postOnly, reduceOnly, etc.
    );

    const orderId =
      body?.result?.order?.order_id ??
      body?.result?.order_id ??
      body?.result?.trades?.[0]?.order_id;

    return orderId;
  } catch (err) {
    console.error("Error placing sell order:", err);
  }
}