import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { DeveloperClient } from "./developer-client";

export default async function DeveloperPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");

  // Prefer the live request host so the docs show a working base URL.
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  const baseUrl = host ? `${proto}://${host}` : process.env.APP_URL || "http://localhost:3000";

  return <DeveloperClient baseUrl={baseUrl} />;
}
