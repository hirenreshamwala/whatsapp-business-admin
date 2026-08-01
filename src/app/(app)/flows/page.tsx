import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FlowsClient } from "./flows-client";

export default async function FlowsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");
  return <FlowsClient />;
}
