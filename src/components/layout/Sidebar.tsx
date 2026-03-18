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
  Home,
  Landmark,
  CheckSquare,
  BarChart3,
  Settings,
  Activity,
  Upload,
  Mail,
  ClipboardCheck,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Pipeline", href: "/pipeline", icon: Kanban },
      { name: "Loans", href: "/loans", icon: FileText },
      { name: "Contacts", href: "/contacts", icon: Users },
      { name: "Payments", href: "/payments", icon: CreditCard },
      { name: "Documents", href: "/documents", icon: FolderOpen },
      { name: "Properties", href: "/properties", icon: Home },
      { name: "Capital", href: "/capital", icon: Landmark },
    ],
  },
  {
    items: [
      { name: "Tasks", href: "/tasks", icon: CheckSquare },
      { name: "Conditions", href: "/conditions", icon: ClipboardCheck },
      { name: "Communications", href: "/communications", icon: Mail },
      { name: "Reports", href: "/reports", icon: BarChart3 },
      { name: "Analytics", href: "/analytics", icon: Activity },
      { name: "Statements", href: "/statements", icon: ScrollText },
    ],
  },
  {
    items: [
      { name: "Import", href: "/import", icon: Upload },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-stone-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1E3A5F] text-white text-xs font-bold">
          S
        </div>
        <span className="text-lg font-bold text-stone-900">StrongBox</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className="my-3 mx-3 border-t border-stone-100" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                      isActive
                        ? "bg-[#EFF4F9] text-[#1E3A5F] font-medium"
                        : "text-stone-600 hover:text-stone-900 hover:bg-stone-100 font-medium"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isActive ? "text-[#1E3A5F]" : "text-stone-400"
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
