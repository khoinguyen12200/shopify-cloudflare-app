import {
  LayoutGrid,
  Users,
  Receipt,
  Store,
  LifeBuoy,
  User as UserIcon,
  Cpu,
  Bot,
} from "lucide-react";
import type { NavGroupData } from "ngk-dashboard";

/** The console's sidebar, declared as data beside the layout that renders it. */
export const INTERNAL_NAV: NavGroupData[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/internal/dashboard", icon: LayoutGrid },
      { title: "Shops", href: "/internal/shops", icon: Store },
      { title: "Support", href: "/internal/support", icon: LifeBuoy },
    ],
  },
  {
    title: "Team",
    items: [
      { title: "Admins", href: "/internal/admins", icon: Users },
      { title: "Subscriptions", href: "/internal/subscriptions", icon: Receipt },
      { title: "AI", href: "/internal/ai", icon: Cpu },
      { title: "MCP & API", href: "/internal/mcp", icon: Bot },
    ],
  },
  {
    title: "Account",
    items: [
      { title: "Profile", href: "/internal/profile", icon: UserIcon },
    ],
  },
];
