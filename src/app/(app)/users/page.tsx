import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");
  return <UsersClient currentUserId={session.user.id} />;
}
