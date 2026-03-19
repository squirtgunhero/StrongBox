import { cn } from "@/lib/utils";
import type { LoanStatus } from "@prisma/client";

const STATUS_STYLES: Record<string, string> = {
  LEAD: "bg-zinc-500/10 text-zinc-600",
  APPLICATION: "bg-[#C33732]/10 text-[#A52F2B]",
  PROCESSING: "bg-purple-500/10 text-purple-400",
  UNDERWRITING: "bg-indigo-500/10 text-indigo-400",
  CONDITIONAL_APPROVAL: "bg-amber-500/10 text-amber-400",
  APPROVED: "bg-emerald-500/10 text-emerald-400",
  CLOSING: "bg-cyan-500/10 text-cyan-400",
  FUNDED: "bg-[#C33732]/10 text-[#A52F2B]",
  ACTIVE: "bg-emerald-500/10 text-emerald-400",
  EXTENDED: "bg-yellow-500/10 text-yellow-400",
  PAYOFF_REQUESTED: "bg-orange-500/10 text-orange-400",
  PAID_OFF: "bg-zinc-500/10 text-zinc-600",
  DEFAULT: "bg-red-500/10 text-red-400",
  FORECLOSURE: "bg-red-500/15 text-red-400",
  REO: "bg-red-500/15 text-red-400",
  CANCELLED: "bg-zinc-500/10 text-zinc-500",
  DENIED: "bg-red-500/10 text-red-400",
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
        STATUS_STYLES[status] ?? "bg-zinc-500/10 text-zinc-600"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
