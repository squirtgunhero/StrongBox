"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Loader2,
  FileText,
  AlertTriangle,
  DollarSign,
  ClipboardCheck,
  Upload,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils/dates";
import Link from "next/link";

const TYPE_ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  TASK_ASSIGNED: { icon: ClipboardCheck, color: "text-[#C33732] bg-[#C33732]/10" },
  DOCUMENT_UPLOADED: { icon: Upload, color: "text-emerald-500 bg-emerald-50950" },
  DOCUMENT_REQUESTED: { icon: FileText, color: "text-amber-500 bg-amber-50950" },
  STATUS_CHANGE: { icon: RefreshCw, color: "text-purple-500 bg-purple-50950" },
  PAYMENT_DUE: { icon: DollarSign, color: "text-amber-500 bg-amber-50950" },
  PAYMENT_RECEIVED: { icon: DollarSign, color: "text-emerald-500 bg-emerald-50950" },
  PAYMENT_LATE: { icon: AlertTriangle, color: "text-red-500 bg-red-50950" },
  DRAW_SUBMITTED: { icon: FileText, color: "text-[#C33732] bg-[#C33732]/10" },
  DRAW_APPROVED: { icon: CheckCheck, color: "text-emerald-500 bg-emerald-50950" },
  DRAW_REJECTED: { icon: AlertTriangle, color: "text-red-500 bg-red-50950" },
  APPROVAL_NEEDED: { icon: ClipboardCheck, color: "text-amber-500 bg-amber-50950" },
  LOAN_MATURITY_WARNING: { icon: AlertTriangle, color: "text-red-500 bg-red-50950" },
  SYSTEM: { icon: Bell, color: "text-zinc-500 bg-white/10" },
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=50");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-white/5 transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl p-12 text-center">
          <Bell className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No notifications</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif: any) => {
            const typeCfg = TYPE_ICONS[notif.type] || TYPE_ICONS.SYSTEM;
            const TypeIcon = typeCfg.icon;

            return (
              <div
                key={notif.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                  notif.isRead
                    ? "bg-white"
                    : "bg-[#C33732]/10 border-[#EFF4F9] "
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 rounded-full p-2",
                    typeCfg.color
                  )}
                >
                  <TypeIcon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "text-sm",
                        !notif.isRead && "font-medium"
                      )}
                    >
                      {notif.title}
                    </p>
                    <span className="text-[11px] text-zinc-500 whitespace-nowrap flex-shrink-0">
                      {formatRelative(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{notif.message}</p>

                  <div className="flex items-center gap-3 mt-2">
                    {notif.actionUrl && (
                      <Link
                        href={notif.actionUrl}
                        className="flex items-center gap-1 text-xs text-[#C33732] hover:text-[#A52F2B]"
                      >
                        View <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                    {!notif.isRead && (
                      <button
                        onClick={() => markRead.mutate(notif.id)}
                        className="text-xs text-zinc-500 hover:text-zinc-600"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>

                {!notif.isRead && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-2 w-2 rounded-full bg-[#C33732]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
