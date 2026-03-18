import { cn } from "@/lib/utils";
import type { LoanStatus } from "@prisma/client";

const STATUS_STYLES: Record<string, string> = {
  LEAD: "bg-stone-100 text-stone-600",
  APPLICATION: "bg-[#EFF6FF] text-[#2563EB]",
  PROCESSING: "bg-purple-50 text-purple-600",
  UNDERWRITING: "bg-indigo-50 text-indigo-600",
  CONDITIONAL_APPROVAL: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-600",
  CLOSING: "bg-cyan-50 text-cyan-700",
  FUNDED: "bg-[#EFF6FF] text-[#2563EB]",
  ACTIVE: "bg-[#F0FDF4] text-[#16A34A]",
  EXTENDED: "bg-[#FEFCE8] text-[#CA8A04]",
  PAYOFF_REQUESTED: "bg-orange-50 text-orange-600",
  PAID_OFF: "bg-stone-100 text-stone-600",
  DEFAULT: "bg-[#FEF2F2] text-[#DC2626]",
  FORECLOSURE: "bg-red-100 text-red-700",
  REO: "bg-red-100 text-red-700",
  CANCELLED: "bg-stone-100 text-stone-500",
  DENIED: "bg-[#FEF2F2] text-[#DC2626]",
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
        STATUS_STYLES[status] ?? "bg-stone-100 text-stone-600"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
