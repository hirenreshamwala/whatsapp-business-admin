import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");
  return <SettingsClient />;
}
