"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Kanban,
  BriefcaseBusiness,
  Users,
  CreditCard,
  FolderOpen,
  Home,
  Landmark,
  CheckSquare,
  BarChart3,
  Settings,
  Upload,
  Mail,
  ClipboardCheck,
  ScrollText,
  ChevronLeft,
  PanelLeft,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "OPERATIONS",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Pipeline", href: "/pipeline", icon: Kanban },
      { name: "Loans", href: "/loans", icon: BriefcaseBusiness },
      { name: "Contacts", href: "/contacts", icon: Users },
      { name: "Payments", href: "/payments", icon: CreditCard },
      { name: "Documents", href: "/documents", icon: FolderOpen },
      { name: "Properties", href: "/properties", icon: Home },
      { name: "Capital", href: "/capital", icon: Landmark },
    ],
  },
  {
    label: "WORKFLOWS",
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
    label: "SYSTEM",
    items: [
      { name: "Import", href: "/import", icon: Upload },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-black/10 bg-gradient-to-b from-white via-[#fafafa] to-[#f3f3f3] transition-all duration-300",
        collapsed ? "w-[78px]" : "w-[280px]"
      )}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#C33732] to-[#8F2521] shadow-[0_8px_20px_-8px_rgba(195,55,50,0.75)]">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold tracking-wide text-black">StrongBox</p>
                <p className="truncate text-[11px] text-zinc-600">Lending Operations Cloud</p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-black/5 hover:text-black"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-left text-sm text-zinc-700 transition hover:border-black/20 hover:bg-[#f8f8f8] hover:text-black",
            collapsed && "justify-center px-0"
          )}
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4" />
          {!collapsed ? (
            <>
              <span className="grow">Command palette</span>
              <span className="rounded-md border border-black/10 bg-[#f3f3f3] px-1.5 py-0.5 text-[10px]">Cmd K</span>
            </>
          ) : null}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map((group, gi) => (
          <section key={group.label} className={cn(gi > 0 && "mt-3")}>
            {!collapsed ? (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-gradient-to-r from-[#C33732] to-[#A52F2B] text-white shadow-[0_12px_24px_-14px_rgba(195,55,50,0.8)]"
                        : "text-zinc-700 hover:bg-black/[0.05] hover:text-black"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-white" : "text-zinc-500 group-hover:text-black"
                      )}
                    />
                    {!collapsed ? (
                      <span className={cn("truncate font-medium", isActive ? "text-white" : "text-zinc-800")}>{item.name}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-black/10 p-3">
        <div
          className={cn(
            "rounded-xl border border-black/10 bg-gradient-to-r from-white to-[#f8f8f8] px-3 py-2.5",
            collapsed && "px-2"
          )}
        >
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            <Sparkles className="h-4 w-4 text-[#C33732]" />
            {!collapsed ? (
              <>
                <p className="text-xs text-zinc-700">Ops Health</p>
                <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  Stable
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
