"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  FileText,
  Users,
  CreditCard,
  FolderOpen,
  Hammer,
  Home,
  Landmark,
  CheckSquare,
  BarChart3,
  Settings,
  Bell,
  Activity,
  Upload,
  Mail,
  ClipboardCheck,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Loans", href: "/loans", icon: FileText },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Documents", href: "/documents", icon: FolderOpen },
  { name: "Properties", href: "/properties", icon: Home },
  { name: "Draws", href: "/loans", icon: Hammer },
  { name: "Capital", href: "/capital", icon: Landmark },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Conditions", href: "/conditions", icon: ClipboardCheck },
  { name: "Communications", href: "/communications", icon: Mail },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Analytics", href: "/analytics", icon: Activity },
  { name: "Statements", href: "/statements", icon: ScrollText },
  { name: "Import", href: "/import", icon: Upload },
];

const bottomNavigation = [
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-white dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex h-16 items-center gap-2 border-b px-6 dark:border-zinc-800">
        <Landmark className="h-6 w-6 text-brand-600" />
        <span className="text-lg font-semibold">StrongBox</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-3 py-4 dark:border-zinc-800">
        {bottomNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
