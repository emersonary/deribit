import { App } from "@slack/bolt";
import { getLastAccountSummary } from "../state/lastAccountSummary";

function fmt(n: number | null | undefined, locale = "en-US") {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
}

function buildBlocks() {
  const snap = getLastAccountSummary();
  if (!snap) {
    return [{ type: "section", text: { type: "mrkdwn", text: ":grey_question: No snapshot yet." } }];
  }
  const ts = Math.floor((snap.updated_at ?? Date.now()) / 1000);
  return [
    { type: "header", text: { type: "plain_text", text: "Deribit – Latest Account Summary" } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Last Price*\n$${fmt(snap.last_price)}` },
        { type: "mrkdwn", text: `*Equity (USD)*\n$${fmt(snap.equity_usd)}` },
        { type: "mrkdwn", text: `*Delta Total*\n$${fmt(snap.delta_total)}` },
      ],
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `Last update: <!date^${ts}^{date_num} {time_secs}|${new Date(snap.updated_at).toISOString()}>` },
      ],
    },
  ];
}

export async function startSlackSocket() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,     // xoxb-...
    appToken: process.env.SLACK_APP_TOKEN,  // xapp-...
    socketMode: true,
  });

  // Option A: Slash command (/deribit summary)
  app.command("/deribit", async ({ command, ack, respond }) => {
    console.log("responding " + command.text + " command");
    await ack();
    const sub = (command.text || "").trim().toLowerCase();
    if (!sub || sub === "summary") {
      await respond({ response_type: "in_channel", blocks: buildBlocks() });
    } else {
      await respond({ response_type: "ephemeral", text: "Usage: `/deribit summary`" });
    }
  });

  // Option B: App mentions (@DeribitBot summary)
  app.event("app_mention", async ({ event, say }) => {
    const text = (event as any).text?.toLowerCase() ?? "";
    if (text.includes("summary")) {
      await say({ blocks: buildBlocks() });
    } else {
      await say("Try `summary`.");
    }
  });

  await app.start();
  console.log("⚡ Slack Socket Mode connected");
}
