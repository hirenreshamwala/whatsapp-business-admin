import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, LayoutTemplate, Megaphone, Users } from "lucide-react";

async function getStats() {
  const [conversations, unread, templates, approved, contacts, broadcasts] = await Promise.all([
    prisma.conversation.count(),
    prisma.conversation.aggregate({ _sum: { unreadCount: true } }),
    prisma.template.count(),
    prisma.template.count({ where: { status: "APPROVED" } }),
    prisma.contact.count(),
    prisma.broadcast.count(),
  ]);
  return {
    conversations,
    unread: unread._sum.unreadCount ?? 0,
    templates,
    approved,
    contacts,
    broadcasts,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const stats = await getStats();

  const tiles = [
    { label: "Conversations", value: stats.conversations, sub: `${stats.unread} unread`, href: "/inbox", icon: MessageSquare },
    { label: "Templates", value: stats.templates, sub: `${stats.approved} approved`, href: "/templates", icon: LayoutTemplate },
    { label: "Contacts", value: stats.contacts, sub: "in address book", href: "/contacts", icon: Users },
    { label: "Broadcasts", value: stats.broadcasts, sub: "campaigns", href: "/broadcasts", icon: Megaphone },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`Welcome, ${session?.user.name?.split(" ")[0] ?? "there"}`}
        description="Overview of your WhatsApp Business workspace."
      />
      <div className="grid grid-cols-1 gap-3 p-3 min-[430px]:grid-cols-2 sm:p-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold leading-none">{t.value}</div>
                    <div className="text-xs text-muted-foreground">{t.label}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{t.sub}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
