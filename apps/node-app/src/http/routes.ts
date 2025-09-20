import { Router } from "express";
import { loginAndIssueToken } from "./auth";
import { authGuard, AuthedRequest } from "./authGuard";
import { getAllLastAccountSummaries } from "../state/lastAccountSummary";

export const routes = Router();

/** Public: authentication */
routes.post("/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const token = loginAndIssueToken(String(username ?? ""), String(password ?? ""));
  if (!token) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ access_token: token, token_type: "Bearer", expires_in: 7200 });
});

/** Protected: simple health/info */
routes.get("/me", authGuard, (req: AuthedRequest, res) => {
  res.json({ ok: true, user: req.user });
});

/** Helper: extract base currency from instrument key */
function currencyFromInstrument(instrument: string): string {
  // e.g. "BTC-PERPETUAL" -> "BTC", "ETH-27DEC25" -> "ETH"
  return (instrument.split("-")[0] || instrument).toUpperCase();
}

/** Helper: parse ?currency=... from query (string | string[]) */
function parseCurrencies(q: unknown): string[] | null {
  if (q == null) return null;
  if (Array.isArray(q)) {
    // /summary/last?currency=BTC&currency=ETH
    return q.flatMap(s => String(s).split(",")).map(s => s.trim().toUpperCase()).filter(Boolean);
  }
  // /summary/last?currency=BTC,ETH  OR  ?currency=BTC
  return String(q).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
}

/** Protected: business endpoint using singleton snapshot, with optional currency filter */
routes.get("/summary/last", authGuard, (req, res) => {
  const all = getAllLastAccountSummaries() as Record<string, any> | null | undefined;
  if (!all || Object.keys(all).length === 0) return res.status(204).send(); // no content yet

  const wanted = parseCurrencies((req.query as any).currency);
  if (!wanted || wanted.length === 0) {
    return res.json(all); // no filter provided -> original behavior
  }

  const wantedSet = new Set(wanted);
  const filteredEntries = Object.entries(all).filter(([instrument]) =>
    wantedSet.has(currencyFromInstrument(instrument))
  );

  // Return the same shape (object keyed by instrument)
  const filtered = Object.fromEntries(filteredEntries);

  // You could return 204 if filter produces empty set; here we return 200 {} for clarity.
  return res.json(filtered);
});
