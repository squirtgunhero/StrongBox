"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Search,
  ArrowRight,
  ClipboardCheck,
  Upload,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils/dates";

const TYPE_ICONS: Record<string, typeof Bell> = {
  TASK_ASSIGNED: ClipboardCheck,
  DOCUMENT_UPLOADED: Upload,
  DOCUMENT_REQUESTED: FileText,
  STATUS_CHANGE: RefreshCw,
  PAYMENT_DUE: DollarSign,
  PAYMENT_RECEIVED: DollarSign,
  PAYMENT_LATE: AlertTriangle,
  APPROVAL_NEEDED: ClipboardCheck,
  LOAN_MATURITY_WARNING: AlertTriangle,
};

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

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const pageTitle = PAGE_TITLES[pathname] || PAGE_TITLES["/" + pathname.split("/")[1]] || "";

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData(["notifications"]);
      queryClient.setQueryData(["notifications"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          unreadCount: Math.max(0, (old.unreadCount || 1) - 1),
          notifications: old.notifications?.map((n: any) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showDropdown || showUserMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showDropdown, showUserMenu]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between px-6" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      <h1 className="text-xl font-semibold tracking-tight text-white">
        {pageTitle}
      </h1>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors" style={{ border: "1px solid var(--border)", background: "var(--surface-secondary)" }}>
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="ml-4 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-500" style={{ border: "1px solid var(--border)", background: "var(--background)" }}>
            ⌘K
          </kbd>
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative rounded-md p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-[#3B82F6]" />
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-96 rounded-lg shadow-2xl z-50" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-[#3B82F6] hover:text-blue-400 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="h-8 w-8 text-zinc-600 mx-auto mb-2" strokeWidth={1} />
                    <p className="text-xs text-zinc-500">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif: any) => {
                    const Icon = TYPE_ICONS[notif.type] || Bell;
                    return (
                      <div
                        key={notif.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors",
                          !notif.isRead && "bg-blue-500/5"
                        )}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <Icon className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs text-zinc-300", !notif.isRead && "font-medium text-white")}>
                            {notif.title}
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-600">
                              {formatRelative(notif.createdAt)}
                            </span>
                            {notif.actionUrl && (
                              <Link
                                href={notif.actionUrl}
                                onClick={() => {
                                  if (!notif.isRead) markRead.mutate(notif.id);
                                  setShowDropdown(false);
                                }}
                                className="text-[10px] text-[#3B82F6] hover:text-blue-400 font-medium"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        </div>
                        {!notif.isRead && (
                          <div className="h-2 w-2 rounded-full bg-[#3B82F6] mt-1 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-4 py-2" style={{ borderTop: "1px solid var(--border)" }}>
                <Link
                  href="/notifications"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center justify-center gap-1 text-xs text-[#3B82F6] hover:text-blue-400 font-medium py-1"
                >
                  View all notifications <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="h-8 w-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            U
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-2xl z-50 py-1" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}>
              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 transition-colors"
              >
                <Settings className="h-4 w-4 text-zinc-500" />
                Settings
              </Link>
              <div className="my-1" style={{ borderTop: "1px solid var(--border)" }} />
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 transition-colors"
              >
                <LogOut className="h-4 w-4 text-zinc-500" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
