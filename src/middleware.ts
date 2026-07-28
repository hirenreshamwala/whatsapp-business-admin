import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge middleware uses the DB-free config; it only reads the JWT.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect everything except Next internals, the auth API, the webhook, the
  // API-key-authenticated public API (/api/v1), and static assets.
  matcher: ["/((?!api/auth|api/webhook|api/v1|_next/static|_next/image|favicon.ico).*)"],
};
