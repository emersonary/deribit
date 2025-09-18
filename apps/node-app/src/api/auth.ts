// auth.ts
import { AuthenticationApi } from "@deribit/api/authenticationApi";
import 'dotenv/config';

type TokenBundle = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
};

const HOST = process.env.DERIBIT_HOST ?? "test.deribit.com";
const BASE = `https://${HOST}/api/v2`;
const CLIENT_ID = process.env.DERIBIT_CLIENT_ID!;
const CLIENT_SECRET = process.env.DERIBIT_CLIENT_SECRET!
const SCOPE = process.env.DERIBIT_SCOPE ?? "session:node-app account:read wallet:read";

// refresh a bit early to avoid edge races
const SKEW_MS = 30_000; // 30s

class TokenManager {
  private static _instance: TokenManager;
  private authApi = new AuthenticationApi(BASE);
  private bundle: TokenBundle | null = null;
  private inFlight?: Promise<string>; // prevent thundering herd

  static instance(): TokenManager {
    if (!TokenManager._instance) TokenManager._instance = new TokenManager();
    return TokenManager._instance;
  }

  /** Public: returns a valid access token, refreshing if needed */
  async getAccessToken(): Promise<string> {
    // If there is an inflight auth, await it (avoid parallel auth calls)
    if (this.inFlight) return this.inFlight;

    const now = Date.now();
    if (this.bundle && now < this.bundle.expiresAt - SKEW_MS) {
      return this.bundle.accessToken;
    }

    // Need to (re)authenticate or refresh
    this.inFlight = (async () => {
      try {
        if (this.bundle?.refreshToken) {
          try {
            return await this.refreshWithRefreshToken(this.bundle.refreshToken!);
          } catch {
            // fall back to client_credentials below
          }
        }
        return await this.authenticateClientCredentials();
      } finally {
        // clear latch after completion
        const t = this.inFlight;
        // ensure we only clear if we are the same promise (rare reentrancy)
        if (this.inFlight === t) this.inFlight = undefined;
      }
    })();

    return this.inFlight;
  }

  /** Helper to format auth header */
  async getAuthHeader(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  /** Force drop the cached token (optional) */
  invalidate() {
    this.bundle = null;
  }

  private async authenticateClientCredentials(): Promise<string> {
    // publicAuthGet(grantType, username, password, clientId, clientSecret, refreshToken, timestamp, signature, nonce?, state?, scope?)
    const { body } = await this.authApi.publicAuthGet(
      "client_credentials",
      "" as any,
      "" as any,
      CLIENT_ID,
      CLIENT_SECRET,
      "" as any,
      "" as any,
      "" as any,
      undefined,
      undefined,
      SCOPE
    );

    const res = (body as any)?.result ?? {};
    const access = res.access_token as string | undefined;
    const refresh = res.refresh_token as string | undefined;
    const expiresIn = Number(res.expires_in ?? 0); // seconds

    if (!access || !expiresIn) throw new Error("Deribit auth failed: missing token/expires_in");

    this.bundle = {
      accessToken: access,
      refreshToken: refresh,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return access;
  }

  private async refreshWithRefreshToken(refreshToken: string): Promise<string> {
    const { body } = await this.authApi.publicAuthGet(
      "refresh_token",
      "" as any,
      "" as any,
      CLIENT_ID,               // some specs ignore this for refresh, but generator requires it
      CLIENT_SECRET as any,    // idem
      refreshToken,
      "" as any,
      "" as any,
      undefined,
      undefined,
      undefined                 // scope optional on refresh; server reuses session scopes
    );

    const res = (body as any)?.result ?? {};
    const access = res.access_token as string | undefined;
    const newRefresh = res.refresh_token as string | undefined;
    const expiresIn = Number(res.expires_in ?? 0);

    if (!access || !expiresIn) throw new Error("Deribit refresh failed: missing token/expires_in");

    this.bundle = {
      accessToken: access,
      refreshToken: newRefresh ?? refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return access;
  }
}

// Public helpers
export async function getDeribitAccessToken() {
  return TokenManager.instance().getAccessToken();
}

export async function getAuthHeader() {
  return TokenManager.instance().getAuthHeader();
}

export function invalidateDeribitToken() {
  TokenManager.instance().invalidate();
}
