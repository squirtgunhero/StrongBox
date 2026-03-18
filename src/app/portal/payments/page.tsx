"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

export default function PortalPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal"],
    queryFn: async () => {
      const res = await fetch("/api/portal?view=borrower");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const loans = data?.loans || [];
  const allPayments = loans.flatMap((l: any) =>
    (l.payments || []).map((p: any) => ({
      ...p,
      loanNumber: l.loanNumber,
      loanId: l.id,
    }))
  );

  const upcoming = allPayments.filter(
    (p: any) => p.status === "SCHEDULED" || p.status === "PENDING"
  );
  const history = allPayments.filter(
    (p: any) => p.status !== "SCHEDULED" && p.status !== "PENDING"
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Payments</h1>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming Payments */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Upcoming Payments</h2>
            {upcoming.length === 0 ? (
              <div className="rounded-lg border bg-white p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-stone-500">No upcoming payments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((pmt: any) => {
                  const dueDate = new Date(pmt.dueDate);
                  const isOverdue = dueDate < new Date();

                  return (
                    <div
                      key={pmt.id}
                      className={cn(
                        "rounded-lg border bg-white p-4",
                        isOverdue && "border-red-200 bg-red-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {formatCurrency(pmt.amount)}
                            <span className="text-stone-400 ml-2 text-xs font-normal">
                              Loan {pmt.loanNumber}
                            </span>
                          </p>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Due {dueDate.toLocaleDateString()}
                            {isOverdue && (
                              <span className="text-red-600 ml-2 font-medium">OVERDUE</span>
                            )}
                          </p>
                          <p className="text-[10px] text-stone-400 mt-1">
                            Principal: {formatCurrency(pmt.principalAmount)} | Interest:{" "}
                            {formatCurrency(pmt.interestAmount)}
                          </p>
                        </div>
                        <div>
                          {process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ? (
                            <a
                              href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-xs font-medium text-white hover:bg-[#162D4A]"
                            >
                              <CreditCard className="h-3.5 w-3.5" /> Pay Now
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <div className="text-xs text-stone-400 text-right">
                              <p>Wire or ACH</p>
                              <p className="text-[10px]">Contact us for payment instructions</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment History */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Payment History</h2>
            {history.length === 0 ? (
              <div className="rounded-lg border bg-white p-8 text-center">
                <CreditCard className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                <p className="text-sm text-stone-500">No payment history yet</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-stone-50">
                      <th className="px-4 py-3 text-left font-medium text-stone-500">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-stone-500">Loan</th>
                      <th className="px-4 py-3 text-right font-medium text-stone-500">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-stone-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((pmt: any) => (
                      <tr key={pmt.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-xs">
                          {pmt.paidDate
                            ? new Date(pmt.paidDate).toLocaleDateString()
                            : new Date(pmt.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-stone-500">{pmt.loanNumber}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(pmt.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <PaymentStatusBadge status={pmt.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: "text-emerald-600 bg-emerald-50",
    LATE: "text-red-600 bg-red-50",
    NSF: "text-red-600 bg-red-50",
    WAIVED: "text-stone-500 bg-stone-100",
  };

  return (
    <span className={cn("text-xs font-medium rounded-full px-2 py-0.5", styles[status] || "bg-stone-100 text-stone-600")}>
      {status}
    </span>
  );
}
