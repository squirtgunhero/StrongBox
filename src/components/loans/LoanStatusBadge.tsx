import { cn } from "@/lib/utils";
import type { LoanStatus } from "@prisma/client";

const STATUS_STYLES: Record<string, string> = {
  LEAD: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  APPLICATION: "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400",
  PROCESSING: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  UNDERWRITING: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  CONDITIONAL_APPROVAL: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  CLOSING: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400",
  FUNDED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  EXTENDED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  PAYOFF_REQUESTED: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  PAID_OFF: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  DEFAULT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  FORECLOSURE: "bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-400",
  REO: "bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-400",
  CANCELLED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  DENIED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  LEAD: "Lead",
  APPLICATION: "Application",
  PROCESSING: "Processing",
  UNDERWRITING: "Underwriting",
  CONDITIONAL_APPROVAL: "Conditional",
  APPROVED: "Approved",
  CLOSING: "Closing",
  FUNDED: "Funded",
  ACTIVE: "Active",
  EXTENDED: "Extended",
  PAYOFF_REQUESTED: "Payoff Req.",
  PAID_OFF: "Paid Off",
  DEFAULT: "Default",
  FORECLOSURE: "Foreclosure",
  REO: "REO",
  CANCELLED: "Cancelled",
  DENIED: "Denied",
};

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-700"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
