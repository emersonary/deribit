// api/getTicker.ts
import { Ticker } from "@goldie/models";
import { PublicApi } from "@deribit/api/publicApi";

export async function getTicker(instrumentName: string): Promise<Ticker> {
  const client = new PublicApi();

  const now = new Date();
  const { body } = await client.publicTickerGet(instrumentName);

  // Deribit SDK often wraps responses inside `result`
  const anyBody = body as any;
  const data = (anyBody?.result ?? anyBody);

  return {
    time_stamp: now,
    instrument_name: (data as any).instrument_name ?? (data as any).instrumentName,
    last_price: (data as any).last_price ?? (data as any).lastPrice,
    volume: (data as any).stats?.volume ?? 0,
  };
}
