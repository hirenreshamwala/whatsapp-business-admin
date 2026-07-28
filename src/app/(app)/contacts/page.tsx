import { auth } from "@/auth";
import { ContactsClient } from "./contacts-client";

export default async function ContactsPage() {
  const session = await auth();
  return <ContactsClient isAdmin={session?.user.role === "ADMIN"} />;
}
