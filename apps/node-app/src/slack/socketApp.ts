import { App } from "@slack/bolt";
import 'dotenv/config';
import { getStatusInstruments } from "../state/status";

// UPDATED import: use the per-currency store
import {
  getAllLastAccountSummaries,
  type Currency,
} from "../state/lastAccountSummary";

function fmt(n: number | null | undefined, locale = "en-US") {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
}

function instrumentOf(c: string) {
  return `${c}-PERPETUAL`;
}

function currencyFromInstrument(instrument: string): Currency {
  // e.g. "BTC-PERPETUAL" -> "BTC", "ETH-27DEC25" -> "ETH"
  const [cur] = instrument.split("-");
  return (cur?.toUpperCase() ?? instrument) as Currency;
}
/**
 * Build Slack blocks for all (or a subset of) currencies.
 * Pass `filterCurrencies` like ["BTC"] to show only BTC.
 */
async function buildBlocks(filterCurrencies?: Currency[]) {
  const all = getAllLastAccountSummaries() as Record<string, any>; // { "BTC-PERPETUAL": snap, ... }
  const allStatuses = await getStatusInstruments();
  // project into { instrument, currency, snap }
  const rows = Object.entries(all)
    .map(([instrument, snap]) => ({
      instrument,
      currency: currencyFromInstrument(instrument),
      snap,
    }))
    .filter(
      ({ currency }) =>
        !filterCurrencies ||
        filterCurrencies.map((c) => c.toUpperCase()).includes(currency)
    )
    // BTC first, then alpha by currency
    .sort((a, b) =>
      a.currency === "BTC" ? -1 : b.currency === "BTC" ? 1 : a.currency.localeCompare(b.currency)
    );

  if (rows.length === 0) {
    return [{ type: "section", text: { type: "mrkdwn", text: ":grey_question: No snapshot yet." } }];
  }

  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: "Deribit – Latest Account Summary" } },
  ];

  rows.forEach(({ instrument, currency, snap }, idx) => {
    const ts = Math.floor(((snap?.updated_at ?? Date.now()) as number) / 1000);

    const status = allStatuses.instruments?.[instrument] ?? null;

    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Instrument*\n${instrument}` },
        { type: "mrkdwn", text: `*Last Price*\n$${fmt(snap?.last_price)}` },
        { type: "mrkdwn", text: `*Equity (USD)*\n$${fmt(snap?.equity_usd)}` },
        { type: "mrkdwn", text: `*Equity (${currency})*\n${fmt(snap?.equity)}` },
        { type: "mrkdwn", text: `*Delta Total*\n${fmt(snap?.delta_total)}` },
        { type: "mrkdwn", text: `*Diff*\n${fmt(snap?.diff)}` },
      ],
    });

    const contextElements: any[] = [
      {
        type: "mrkdwn",
        text: `*${currency}* · Last update: <!date^${ts}^{date_num} {time_secs}|${new Date(
          snap?.updated_at ?? Date.now()
        ).toISOString()}>`,
      },
    ];

    if (status) {
      contextElements.push({
        type: "mrkdwn",
        text: `*Status*: enabled=${status.adj_enabled ? "✅" : "❌"}, edge=${status.adj_edge}`,
      });
    }

    blocks.push({ type: "context", elements: contextElements });

    if (idx < rows.length - 1) blocks.push({ type: "divider" });
  });

  return blocks;
}

function parseCurrencies(input: string): Currency[] | undefined {
  const t = input.trim().toUpperCase();
  if (!t) return undefined;
  const parts = t.split(/\s+/).map(s => s.trim()).filter(Boolean);
  const valid = parts.filter(p => ["BTC", "ETH"].includes(p)); // extend if you add more
  return valid.length ? (valid as Currency[]) : undefined;
}

export async function startSlackSocket() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,     // xoxb-...
    appToken: process.env.SLACK_APP_TOKEN,  // xapp-...
    socketMode: true,
  });

  // Slash: /deribit summ [BTC|ETH]
  app.command("/deribit", async ({ command, ack, respond }) => {
    await ack();
    console.log("responding " + command.text + " slack command");
    const sub = (command.text || "").trim().toLowerCase();
    if (!sub || sub.startsWith("summ")) {
      const filter = parseCurrencies(command.text.replace(/^summ/i, ""));
      await respond({ response_type: "in_channel", blocks: await buildBlocks(filter) });
    } else {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/deribit summ [BTC|ETH]`",
      });
    }
  });

  // Mentions: @DeribitBot summ [BTC|ETH]
  app.event("app_mention", async ({ event, say }) => {
    const text = (event as any).text?.toLowerCase() ?? "";
    if (text.includes("summ")) {
      const after = text.replace(/.*summ/i, ""); // words after 'summ'
      const filter = parseCurrencies(after);
      await say({ blocks: buildBlocks(filter) });
    } else {
      await say("Try `summ`.");
    }
  });

  await app.start();
  console.log("⚡ Slack Socket Mode connected");
}
