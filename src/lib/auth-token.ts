/**
 * Decode a NextAuth (Auth.js v5) session cookie outside of the Next request
 * context — used by the WebSocket upgrade handler in the custom server.
 *
 * Auth.js encrypts the JWT (JWE) with AUTH_SECRET, salted by the cookie name.
 * We try both the dev and the __Secure- production cookie names.
 */
import { decode } from "next-auth/jwt";

const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

const COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

export type SessionInfo = { userId: string; role: string };

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export async function verifySessionToken(cookieHeader: string): Promise<SessionInfo | null> {
  if (!SECRET) return null;
  const cookies = parseCookies(cookieHeader);
  for (const name of COOKIE_NAMES) {
    const token = cookies[name];
    if (!token) continue;
    try {
      const decoded = await decode({ token, secret: SECRET, salt: name });
      if (decoded?.sub) {
        return { userId: decoded.sub, role: (decoded as { role?: string }).role || "AGENT" };
      }
    } catch {
      // try next cookie name
    }
  }
  return null;
}
