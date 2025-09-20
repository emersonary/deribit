import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const AUTH_USER1 = process.env.AUTH_USER1 || "demo1";
const AUTH_PASS1 = process.env.AUTH_PASS1 || "demo123";
const AUTH_USER2 = process.env.AUTH_USER2 || "demo2";
const AUTH_PASS2 = process.env.AUTH_PASS2 || "demo123";

/** Verify credentials and mint a short-lived JWT. */
export function loginAndIssueToken(username: string, password: string): string | null {
  let idUser = 0;
  if (username == AUTH_USER1 && password == AUTH_PASS1) idUser = 1;
  if (username == AUTH_USER2 && password == AUTH_PASS2) idUser = 2;
  if (idUser == 0) return null;

  // keep claims minimal; add roles/permissions later if needed
  const token = jwt.sign(
    { sub: username, typ: "access" },
    JWT_SECRET,
    { expiresIn: "2h", issuer: "node-app" }
  );
  return token;
}
