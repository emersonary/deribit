// apps/node-app/src/http/slack.ts
import crypto from "crypto";
import { Router, Request, Response, NextFunction } from "express";
import { getAllLastAccountSummaries } from "../state/lastAccountSummary";

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || "";
const SKIP_VERIFY = (process.env.SLACK_SKIP_VERIFY || "false").toLowerCase() === "true";

export const slackRouter = Router();

/** Save raw body so we can compute the HMAC later */
export function rawBodySaver(req: any, _res: any, buf: Buffer) {
  // only keep when Slack headers present (optional)
  if (req.headers["x-slack-signature"]) {
    req.rawBody = buf.toString("utf8");
  }
}

/** Verify Slack's signing secret (HMAC SHA256) */
function verifySlackSignature(req: Request, res: Response, next: NextFunction) {
  if (SKIP_VERIFY) return next();

  const ts = req.header("x-slack-request-timestamp");
  const sig = req.header("x-slack-signature");

  if (!ts || !sig || !req.hasOwnProperty("rawBody")) {
    return res.status(401).send("Bad Slack signature");
  }

  // Mitigate replay within 5 minutes
  const fiveMinutes = 60 * 5;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > fiveMinutes) {
    return res.status(401).send("Stale Slack signature");
  }

  const base = `v0:${ts}:${(req as any).rawBody}`;
  const hmac = "v0=" + crypto.createHmac("sha256", SLACK_SIGNING_SECRET).update(base).digest("hex");

  const safeEq =
    crypto.timingSafeEqual(Buffer.from(hmac, "utf8"), Buffer.from(sig, "utf8"));

  if (!safeEq) return res.status(401).send("Invalid Slack signature");
  return next();
}

/** Simple currency formatter */
function fmt(n: number | null | undefined) {
  if (!Number.isFinite(n as number)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n as number);
}

/** Build Slack blocks for the snapshot */
function buildSummaryBlocks() {
  const snap = getAllLastAccountSummaries(); // { last_price, equity_usd, updated_at }
  if (!snap) {
    return [
      { type: "section", text: { type: "mrkdwn", text: ":grey_question: No snapshot yet." } },
    ];
  }
  const ts = Math.floor((snap.updated_at ?? Date.now()) / 1000);
  return [
    { type: "header", text: { type: "plain_text", text: "Deribit – Latest Account Summary" } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Last Price*\n$${fmt(snap.last_price)}` },
        { type: "mrkdwn", text: `*Equity (USD)*\n$${fmt(snap.equity_usd)}` },
        { type: "mrkdwn", text: `*Equity*\n$${fmt(snap.equity)}` },
        { type: "mrkdwn", text: `*Delta Total*\n$${fmt(snap.delta_total)}` },
        { type: "mrkdwn", text: `*Diff*\n$${fmt(snap.diff)}` },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Last update: <!date^${ts}^{date_num} {time_secs}|${new Date(snap.updated_at).toISOString()}>`,
        },
      ],
    },
  ];
}

/** Slash Command endpoint (Request URL) */
slackRouter.post("/command", verifySlackSignature, async (req, res) => {
  // Slack sends application/x-www-form-urlencoded
  const body: any = req.body || {};
  const command = String(body.command || "");
  const text = String(body.text || "").trim();

  // Supported: "/deribit summary" | "/deribit help"
  const [action = "summary"] = text.split(/\s+/);

  if (command && !command.startsWith("/")) {
    return res.status(400).send("Not a slash command");
  }

  if (action === "help") {
    return res.json({
      response_type: "ephemeral",
      text: "Usage: `/deribit summary` — shows last price and equity in this channel.",
    });
  }

  // Default -> summary
  const blocks = buildSummaryBlocks();
  return res.json({
    response_type: "in_channel", // visible to everyone in the channel; use "ephemeral" to show only to requester
    blocks,
  });
});
