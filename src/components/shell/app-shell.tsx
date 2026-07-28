"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { MessageCircle, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/shell/nav";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Props = {
  user: { name: string; email: string; role: "ADMIN" | "AGENT" };
  wabaConnected: boolean;
  phoneNumber: string | null;
  children: React.ReactNode;
};

export function AppShell({ user, wabaConnected, phoneNumber, children }: Props) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || user.role === "ADMIN");
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-52 shrink-0 flex-col border-r bg-card">
        <div className="flex h-12 items-center gap-2 border-b px-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MessageCircle className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">WA Admin</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 scroll-thin">
          {items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 px-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                wabaConnected ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
            {wabaConnected ? phoneNumber || "Connected" : "Not connected"}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-2">
            {!wabaConnected && (
              <Badge variant="warning" className="gap-1">
                Connect your WhatsApp account in Settings
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials || "U"}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-xs font-medium">{user.name}</div>
                <div className="text-[10px] text-muted-foreground">{user.role}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-h-0 flex-1 overflow-auto scroll-thin">{children}</main>
      </div>
    </div>
  );
}
