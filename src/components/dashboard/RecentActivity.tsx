"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, DollarSign, HardHat, UserPlus, Shield, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils/dates";

const ACTION_ICONS: Record<string, { icon: typeof FileText; color: string }> = {
  CREATE: { icon: UserPlus, color: "text-emerald-600 bg-[#f3f3f3]" },
  UPDATE: { icon: ArrowRightLeft, color: "text-[#C33732] bg-[#f3f3f3]" },
  DELETE: { icon: Shield, color: "text-red-500 bg-[#f3f3f3]" },
  STATUS_CHANGE: { icon: ArrowRightLeft, color: "text-violet-600 bg-[#f3f3f3]" },
  UPLOAD: { icon: FileText, color: "text-indigo-600 bg-[#f3f3f3]" },
  PAYMENT: { icon: DollarSign, color: "text-emerald-600 bg-[#f3f3f3]" },
  DRAW: { icon: HardHat, color: "text-amber-600 bg-[#f3f3f3]" },
};

export function RecentActivity() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  const activity = data?.recentActivity || [];

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">Recent Activity</h3>

      {activity.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">No recent activity</p>
      ) : (
        <div className="space-y-3">
          {activity.slice(0, 10).map((item: any) => {
            const actionCfg = ACTION_ICONS[item.action] || ACTION_ICONS.UPDATE;
            const Icon = actionCfg.icon;

            return (
              <div key={item.id} className="flex items-start gap-3">
                <div className={cn("rounded-full p-1.5 mt-0.5 shrink-0", actionCfg.color)}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="font-medium text-zinc-900">
                      {item.user ? `${item.user.firstName} ${item.user.lastName}` : "System"}
                    </span>{" "}
                    <span className="text-zinc-600">
                      {item.action.toLowerCase().replace("_", " ")} {item.entityType?.toLowerCase()}
                    </span>
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{formatRelative(item.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
