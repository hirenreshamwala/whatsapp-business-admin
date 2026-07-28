import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "AGENT";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "ADMIN" | "AGENT";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "AGENT";
  }
}
