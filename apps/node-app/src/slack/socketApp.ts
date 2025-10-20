import { App } from "@slack/bolt";
import "dotenv/config";
import { getStatusInstruments, upsertStatusInstrument } from "../state/status";

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
  const [cur] = instrument.split("-");
  return (cur?.toUpperCase() ?? instrument) as Currency;
}

/** Parse "on/off/1/0/true/false/yes/no" into boolean; undefined if invalid. */
function parseEnabledToken(tok: string | undefined): boolean | undefined {
  if (!tok) return undefined;
  const t = tok.toLowerCase();
  if (["1", "on", "true", "yes", "y"].includes(t)) return true;
  if (["0", "off", "false", "no", "n"].includes(t)) return false;
  return undefined;
}

function parseCurrencies(input: string): Currency[] | undefined {
  const t = input.trim().toUpperCase();
  if (!t) return undefined;
  const parts = t.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  const valid = parts.filter((p) => ["BTC", "ETH"].includes(p)); // extend if you add more
  return valid.length ? (valid as Currency[]) : undefined;
}

/**
 * Build Slack blocks for all (or a subset of) currencies.
 * Pass `filterCurrencies` like ["BTC"] to show only BTC.
 */
async function buildBlocks(filterCurrencies?: Currency[]) {
  const all = getAllLastAccountSummaries() as Record<string, any>;
  const allStatuses = await getStatusInstruments();

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
    .sort((a, b) =>
      a.currency === "BTC" ? -1 : b.currency === "BTC" ? 1 : a.currency.localeCompare(b.currency)
    );

  if (rows.length === 0) {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: ":grey_question: No snapshot yet." },
      },
    ];
  }

  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Deribit – Latest Account Summary" },
    },
  ];

  rows.forEach(({ instrument, currency, snap }, idx) => {
    const ts = Math.floor(((snap?.updated_at ?? Date.now()) as number) / 1000);

    const rawStatus = allStatuses.instruments?.[instrument] ?? null;
    const status = rawStatus ?? { adj_enabled: false, adj_edge: 0 };

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
      {
        type: "mrkdwn",
        text: `*Status*: adjustment=${status.adj_enabled ? "✅" : "❌"}, edge=${status.adj_edge}`,
      },
    ];

    blocks.push({ type: "context", elements: contextElements });

    if (idx < rows.length - 1) blocks.push({ type: "divider" });
  });

  return blocks;
}

export async function startSlackSocket() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
  });

  // Slash: /deribit ...
  app.command("/deribit", async ({ command, ack, respond }) => {
    await ack();
    const raw = (command.text || "").trim();
    const sub = raw.toLowerCase();

    // /deribit adj <value> <EDGE> <CURRENCY>
    if (sub.startsWith("adj ")) {
      try {
        // ["adj", "<value>", "<EDGE>", "<CURRENCY>"]
        const parts = raw.split(/\s+/);
        const valueTok = parts[1];
        const edgeTok = parts[2];
        const curTok = (parts[3] || "").toUpperCase();

        // enabled flag required
        const enabled = parseEnabledToken(valueTok);
        if (enabled === undefined) {
          return respond({
            response_type: "ephemeral",
            text:
              "Usage: `/deribit adj <on|off|1|0|true|false|yes|no> <EDGE> <CURRENCY>`\n" +
              "Example: `/deribit adj 1 0.75 BTC`",
          });
        }

        // EDGE required: finite number and non-negative
        const adj_edge = Number(edgeTok);
        if (!Number.isFinite(adj_edge) || adj_edge < 0) {
          return respond({
            response_type: "ephemeral",
            text:
              "EDGE must be a non-negative number.\n" +
              "Usage: `/deribit adj <on|off|1|0|true|false|yes|no> <EDGE> <CURRENCY>`",
          });
        }

        // CURRENCY required and validated
        if (!curTok || !["BTC", "ETH"].includes(curTok)) {
          return respond({
            response_type: "ephemeral",
            text:
              "You must specify a valid currency.\n" +
              "Usage: `/deribit adj <on|off|1|0|true|false|yes|no> <EDGE> <CURRENCY>`\n" +
              "Valid currencies: BTC, ETH",
          });
        }

        const currency: Currency = curTok as Currency;
        const symbol = instrumentOf(currency);

        // DB upsert
        await upsertStatusInstrument(symbol, { adj_enabled: enabled, adj_edge });

        // Update in-memory cache immediately
        const si = await getStatusInstruments();
        if (!si.instruments) si.instruments = {};
        si.instruments[symbol] = { adj_enabled: enabled, adj_edge };

        return respond({
          response_type: "in_channel",
          text: `Adjustment updated: \`${symbol}\` → enabled=${enabled ? "on" : "off"}, edge=${adj_edge}`,
        });
      } catch (err: any) {
        console.error("adj failed:", err);
        return respond({
          response_type: "ephemeral",
          text: `Failed to update adjustment: ${err?.message ?? "unknown error"}`,
        });
      }
    }

    // Default (or summary): /deribit summ [BTC|ETH]
    if (!sub || sub.startsWith("summ")) {
      const filter = parseCurrencies(raw.replace(/^summ/i, ""));
      const blocks = await buildBlocks(filter);
      return respond({
        response_type: "in_channel",
        text: "Deribit – Latest Account Summary",
        blocks,
      });
    }

    // Help
    return respond({
      response_type: "ephemeral",
      text:
        "Usage:\n" +
        "• `/deribit summ [BTC|ETH]`\n" +
        "• `/deribit adj <on|off|1|0|true|false|yes|no> <EDGE> <CURRENCY>`",
    });
  });

  // Mentions: @DeribitBot summ [BTC|ETH]
  app.event("app_mention", async ({ event, say }) => {
    const text = (event as any).text?.toLowerCase() ?? "";
    if (text.includes("summ")) {
      const after = text.replace(/.*summ/i, ""); // words after 'summ'
      const filter = parseCurrencies(after);
      const blocks = await buildBlocks(filter);
      await say({
        text: "Deribit – Latest Account Summary",
        blocks,
      });
    } else {
      await say(
        "Try `summ` or `/deribit adj <on|off|1|0|true|false|yes|no> <EDGE> <CURRENCY>`"
      );
    }
  });

  await app.start();
  console.log("⚡ Slack Socket Mode connected");
}
