import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BroadcastsClient } from "./broadcasts-client";

export default async function BroadcastsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");
  return <BroadcastsClient />;
}
