import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogsClient } from "./logs-client";

export default async function LogsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");
  return <LogsClient />;
}
