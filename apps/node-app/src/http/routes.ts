import { Router } from "express";
import { loginAndIssueToken } from "./auth";
import { authGuard, AuthedRequest } from "./authGuard";
import { getLastAccountSummary } from "../state/lastAccountSummary";

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

/** Protected: example business endpoint using your singleton snapshot */
routes.get("/summary/last", authGuard, (req, res) => {
  const snap = getLastAccountSummary();
  if (!snap) return res.status(204).send(); // no content yet
  res.json(snap);
});
