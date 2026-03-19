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
  "/dashboard": "Dashboard",
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
    <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-black">{pageTitle}</h1>
          <p className="text-xs text-zinc-600">Operational lending workspace</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="group hidden items-center gap-2 rounded-xl border border-black/10 bg-[#f8f8f8] px-3 py-2 text-sm text-zinc-700 transition hover:border-black/20 hover:bg-[#f3f3f3] hover:text-black md:flex"
          >
            <Search className="h-4 w-4 text-zinc-500 group-hover:text-zinc-700" />
            <span className="text-zinc-600">Search loans, borrowers, actions</span>
            <span className="ml-4 flex items-center gap-1 rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[10px] text-zinc-500">
              <Command className="h-3 w-3" />K
            </span>
          </button>

          <div className="hidden items-center gap-1.5 sm:flex">
            {quickActions.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-[#f8f8f8] px-2.5 py-2 text-xs font-medium text-zinc-700 transition hover:border-black/20 hover:bg-[#f3f3f3] hover:text-black"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#C33732] to-[#A52F2B] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_18px_-12px_rgba(195,55,50,0.9)] transition hover:from-[#B0332E] hover:to-[#8E2824]"
            >
              <CirclePlus className="h-3.5 w-3.5" />
              Create
            </button>

            {showCreateMenu ? (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-black/10 bg-white p-1.5 shadow-2xl">
                {createActions.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setShowCreateMenu(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 transition hover:bg-[#f3f3f3] hover:text-black"
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
            className="relative rounded-lg border border-black/10 bg-[#f8f8f8] p-2 text-zinc-600 transition hover:bg-[#f3f3f3] hover:text-black"
            aria-label="View notifications"
          >
            <BellDot className="h-4 w-4" />
            <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-[#C33732]" />
          </button>

          {showNotifications ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-black/10 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-black">Notifications</h3>
                <span className="rounded-full border border-[#C33732]/35 bg-[#C33732]/10 px-2 py-0.5 text-[11px] font-medium text-[#7D2320]">
                  {notifications.length} new
                </span>
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {notifications.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setShowNotifications(false)}
                    className="flex items-start gap-3 border-b border-black/10 px-4 py-3 transition hover:bg-[#f8f8f8]"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#C33732]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-black">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-600">{item.detail}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">{item.when}</p>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 text-zinc-500" />
                  </Link>
                ))}
              </div>

              <div className="border-t border-black/10 px-4 py-2">
                <Link
                  href="/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="flex items-center justify-center gap-1 py-1 text-xs font-medium text-[#C33732] transition hover:text-[#A52F2B]"
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
            className="flex items-center gap-2 rounded-lg border border-black/10 bg-[#f8f8f8] px-2.5 py-1.5 transition hover:bg-[#f3f3f3]"
            aria-label="Open user menu"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#C33732] to-[#8F2521] text-xs font-semibold text-white">
              ME
            </span>
            <span className="hidden text-xs text-zinc-700 sm:block">Michael E.</span>
          </button>

          {showUserMenu ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-black/10 bg-white py-1 shadow-2xl">
              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition hover:bg-[#f3f3f3] hover:text-black"
              >
                <Settings className="h-4 w-4 text-zinc-500" />
                Settings
              </Link>
              <div className="my-1 border-t border-black/10" />
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition hover:bg-[#f3f3f3] hover:text-black"
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
