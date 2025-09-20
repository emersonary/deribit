import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export interface AuthedRequest extends Request {
  user?: { sub: string };
}

export function authGuard(req: AuthedRequest, res: Response, next: NextFunction) {
  const hdr = req.header("Authorization") || "";
  const match = hdr.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Missing Bearer token" });

  const token = match[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = { sub: payload.sub };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
