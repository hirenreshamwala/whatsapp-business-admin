import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const settings = await prisma.wabaSettings.findUnique({ where: { id: "default" } });
  const wabaConnected = Boolean(settings?.phoneNumberId && settings?.accessTokenEnc);

  return (
    <AppShell
      user={{
        name: session.user.name || session.user.email || "User",
        email: session.user.email || "",
        role: session.user.role,
      }}
      wabaConnected={wabaConnected}
      phoneNumber={settings?.phoneNumberDisplay ?? null}
    >
      {children}
    </AppShell>
  );
}
