export interface Ticker {
  time_stamp: Date;
  instrument_name: string;
  last_price: number;
  volume: number;
}

export interface LastAccountSnapshot {
  last_price: number | null;   // e.g., BTC-PERPETUAL last price (USD)
  equity_usd: number | null;   // your computed/account equity in USD
  updated_at: number;          // Date.now()
}