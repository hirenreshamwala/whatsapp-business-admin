import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");
  return <TemplatesClient />;
}
