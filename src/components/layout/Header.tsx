"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Bell,
  Search,
  CheckCheck,
  ArrowRight,
  ClipboardCheck,
  Upload,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  FileText,
} from "lucide-react";
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

export function Header() {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showDropdown]);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search loans, contacts..."
            className="h-9 w-64 rounded-md border bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border bg-white shadow-lg dark:bg-zinc-900 dark:border-zinc-800 z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">No notifications</p>
                  </div>
                ) : (
                  notifications.map((notif: any) => {
                    const Icon = TYPE_ICONS[notif.type] || Bell;
                    return (
                      <div
                        key={notif.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 border-b last:border-0 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors",
                          !notif.isRead && "bg-brand-50/50 dark:bg-brand-950/20"
                        )}
                      >
                        <Icon className="h-4 w-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs", !notif.isRead && "font-medium")}>
                            {notif.title}
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-400">
                              {formatRelative(notif.createdAt)}
                            </span>
                            {notif.actionUrl && (
                              <Link
                                href={notif.actionUrl}
                                onClick={() => {
                                  if (!notif.isRead) markRead.mutate(notif.id);
                                  setShowDropdown(false);
                                }}
                                className="text-[10px] text-brand-600 hover:text-brand-700"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        </div>
                        {!notif.isRead && (
                          <div className="h-2 w-2 rounded-full bg-brand-500 mt-1 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t dark:border-zinc-800 px-4 py-2">
                <Link
                  href="/notifications"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center justify-center gap-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 py-1"
                >
                  View all notifications <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-medium">
          U
        </div>
      </div>
    </header>
  );
}
