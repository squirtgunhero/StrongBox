"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  BellDot,
  CirclePlus,
  Command,
  FilePlus2,
  LogOut,
  Rocket,
  Search,
  Settings,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/pipeline": "Pipeline",
  "/loans": "Loans",
  "/contacts": "Contacts",
  "/payments": "Payments",
  "/documents": "Documents",
  "/properties": "Properties",
  "/capital": "Capital",
  "/tasks": "Tasks",
  "/conditions": "Conditions",
  "/communications": "Communications",
  "/reports": "Reports",
  "/analytics": "Analytics",
  "/statements": "Statements",
  "/import": "Import",
  "/settings": "Settings",
  "/notifications": "Notifications",
};

type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  when: string;
  href: string;
};

const notifications: NotificationItem[] = [
  {
    id: "n1",
    title: "Late payment alert",
    detail: "SB-24044 is now 8 days overdue",
    when: "6 min ago",
    href: "/loans",
  },
  {
    id: "n2",
    title: "Funding ready",
    detail: "SB-24067 cleared final closing checklist",
    when: "22 min ago",
    href: "/pipeline",
  },
  {
    id: "n3",
    title: "Condition due today",
    detail: "Insurance update required for SB-24031",
    when: "1h ago",
    href: "/conditions",
  },
];

const quickActions = [
  { id: "qa1", label: "New Loan", href: "/loans/new", icon: CirclePlus },
  { id: "qa2", label: "Start Review", href: "/pipeline", icon: Rocket },
];

const createActions = [
  { label: "Loan Application", href: "/loans/new", icon: FilePlus2 },
  { label: "Payment Record", href: "/payments", icon: WalletCards },
  { label: "Task", href: "/tasks", icon: CirclePlus },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const pageTitle = PAGE_TITLES[pathname] || PAGE_TITLES["/" + pathname.split("/")[1]] || "";

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
      if (createMenuRef.current && !createMenuRef.current.contains(target)) {
        setShowCreateMenu(false);
      }
    }

    if (showNotifications || showUserMenu || showCreateMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showNotifications, showUserMenu, showCreateMenu]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1220]/90 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-white">{pageTitle}</h1>
          <p className="text-xs text-zinc-400">Operational lending workspace</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="group hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white md:flex"
          >
            <Search className="h-4 w-4 text-zinc-500 group-hover:text-zinc-200" />
            <span className="text-zinc-400">Search loans, borrowers, actions</span>
            <span className="ml-4 flex items-center gap-1 rounded-md border border-white/10 bg-[#0a111f] px-1.5 py-0.5 text-[10px] text-zinc-500">
              <Command className="h-3 w-3" />K
            </span>
          </button>

          <div className="hidden items-center gap-1.5 sm:flex">
            {quickActions.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </Link>
            ))}
          </div>

          <div className="relative" ref={createMenuRef}>
            <button
              type="button"
              onClick={() => setShowCreateMenu((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#1f5bd6] to-[#2f88ff] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_18px_-12px_rgba(47,136,255,0.95)] transition hover:from-[#2d68df] hover:to-[#4493ff]"
            >
              <CirclePlus className="h-3.5 w-3.5" />
              Create
            </button>

            {showCreateMenu ? (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/10 bg-[#111b2b] p-1.5 shadow-2xl">
                {createActions.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setShowCreateMenu(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <item.icon className="h-4 w-4 text-zinc-500" />
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => setShowNotifications((prev) => !prev)}
            className="relative rounded-lg border border-white/10 bg-white/[0.03] p-2 text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="View notifications"
          >
            <BellDot className="h-4 w-4" />
            <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-[#2f88ff]" />
          </button>

          {showNotifications ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-white/10 bg-[#111b2b] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                <span className="rounded-full border border-blue-400/40 bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-200">
                  {notifications.length} new
                </span>
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {notifications.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setShowNotifications(false)}
                    className="flex items-start gap-3 border-b border-white/10 px-4 py-3 transition hover:bg-white/[0.06]"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-400">{item.detail}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">{item.when}</p>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 text-zinc-500" />
                  </Link>
                ))}
              </div>

              <div className="border-t border-white/10 px-4 py-2">
                <Link
                  href="/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="flex items-center justify-center gap-1 py-1 text-xs font-medium text-blue-300 transition hover:text-blue-200"
                >
                  View all notifications <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 transition hover:bg-white/[0.08]"
            aria-label="Open user menu"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#2f88ff] to-[#1f5bd6] text-xs font-semibold text-white">
              ME
            </span>
            <span className="hidden text-xs text-zinc-300 sm:block">Michael E.</span>
          </button>

          {showUserMenu ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-white/10 bg-[#111b2b] py-1 shadow-2xl">
              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Settings className="h-4 w-4 text-zinc-500" />
                Settings
              </Link>
              <div className="my-1 border-t border-white/10" />
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut className="h-4 w-4 text-zinc-500" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
