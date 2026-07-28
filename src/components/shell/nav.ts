import {
  LayoutDashboard,
  MessageSquare,
  Users,
  LayoutTemplate,
  Megaphone,
  ScrollText,
  Settings,
  Code2,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/templates", label: "Templates", icon: LayoutTemplate, adminOnly: true },
  { href: "/broadcasts", label: "Broadcasts", icon: Megaphone, adminOnly: true },
  { href: "/logs", label: "Logs", icon: ScrollText, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
  { href: "/developer", label: "API", icon: Code2, adminOnly: true },
  { href: "/users", label: "Users", icon: UserCog, adminOnly: true },
];
