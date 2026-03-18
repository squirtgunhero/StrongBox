"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  User,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatRelative } from "@/lib/utils/dates";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { LoanStatus } from "@prisma/client";

const TABS = [
  "Summary",
  "Documents",
  "Payments",
  "Draws",
  "Conditions",
  "Activity",
] as const;
type Tab = (typeof TABS)[number];

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("Summary");
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["loans", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch loan");
      return res.json();
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      const res = await fetch(`/api/loans/${params.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to change status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans", params.id] });
      setShowStatusMenu(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (error || !data?.loan) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-red-500">Loan not found</p>
        <Link href="/loans" className="text-sm text-[#1E3A5F] mt-2 inline-block">
          Back to loans
        </Link>
      </div>
    );
  }

  const loan = data.loan;

  return (
    <div>
      <Link
        href="/loans"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to loans
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{loan.loanNumber}</h1>
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-1"
              >
                <LoanStatusBadge status={loan.status as LoanStatus} />
                <ChevronDown className="h-3 w-3 text-stone-400" />
              </button>
              {showStatusMenu && (
                <StatusMenu
                  currentStatus={loan.status}
                  onSelect={(status) => changeStatus.mutate({ status })}
                  onClose={() => setShowStatusMenu(false)}
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-stone-500">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {loan.borrower.firstName} {loan.borrower.lastName}
            </span>
            {loan.property && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {loan.property.address}, {loan.property.city} {loan.property.state}
              </span>
            )}
            {loan.maturityDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Matures {formatDate(loan.maturityDate)}
              </span>
            )}
          </div>
        </div>

        {/* Key metrics */}
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-stone-500">Loan Amount</p>
            <p className="text-lg font-semibold">{formatCurrency(loan.loanAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Rate</p>
            <p className="text-lg font-semibold">{Number(loan.interestRate).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Term</p>
            <p className="text-lg font-semibold">{loan.termMonths}mo</p>
          </div>
        </div>
      </div>

      {changeStatus.error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {changeStatus.error.message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab
                  ? "border-[#1E3A5F] text-[#1E3A5F]"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              )}
            >
              {tab}
              {tab === "Conditions" && loan.loanConditions?.length > 0 && (
                <span className="ml-1 text-xs">({loan.loanConditions.filter((c: any) => !c.isCleared).length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Summary" && <SummaryTab loan={loan} />}
      {activeTab === "Documents" && <DocsTab documents={loan.documents} />}
      {activeTab === "Payments" && <PaymentsTab payments={loan.payments} />}
      {activeTab === "Draws" && <DrawsTab draws={loan.draws} />}
      {activeTab === "Conditions" && <ConditionsTab conditions={loan.loanConditions} />}
      {activeTab === "Activity" && <ActivityTab history={loan.statusHistory} />}
    </div>
  );
}

function StatusMenu({
  currentStatus,
  onSelect,
  onClose,
}: {
  currentStatus: string;
  onSelect: (status: string) => void;
  onClose: () => void;
}) {
  // Simplified — in production use getAvailableTransitions
  const transitions: Record<string, string[]> = {
    LEAD: ["APPLICATION", "CANCELLED"],
    APPLICATION: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["UNDERWRITING", "CANCELLED"],
    UNDERWRITING: ["CONDITIONAL_APPROVAL", "DENIED"],
    CONDITIONAL_APPROVAL: ["APPROVED", "DENIED"],
    APPROVED: ["CLOSING", "CANCELLED"],
    CLOSING: ["FUNDED", "CANCELLED"],
    FUNDED: ["ACTIVE"],
    ACTIVE: ["EXTENDED", "PAYOFF_REQUESTED", "PAID_OFF", "DEFAULT"],
  };

  const options = transitions[currentStatus] || [];
  if (!options.length) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-md border bg-white shadow-lg">
        {options.map((status) => (
          <button
            key={status}
            onClick={() => onSelect(status)}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-stone-50"
          >
            <LoanStatusBadge status={status as LoanStatus} />
          </button>
        ))}
      </div>
    </>
  );
}

function SummaryTab({ loan }: { loan: any }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {/* Loan Terms */}
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-stone-500 mb-4">Loan Terms</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-stone-500">Type</dt><dd className="font-medium">{loan.type.replace(/_/g, " ")}</dd></div>
            <div><dt className="text-stone-500">Exit Strategy</dt><dd className="font-medium">{loan.exitStrategy?.replace(/_/g, " ") || "-"}</dd></div>
            <div><dt className="text-stone-500">Loan Amount</dt><dd className="font-medium">{formatCurrency(loan.loanAmount)}</dd></div>
            <div><dt className="text-stone-500">Current Balance</dt><dd className="font-medium">{formatCurrency(loan.currentBalance)}</dd></div>
            <div><dt className="text-stone-500">Interest Rate</dt><dd className="font-medium">{Number(loan.interestRate).toFixed(2)}%</dd></div>
            <div><dt className="text-stone-500">Term</dt><dd className="font-medium">{loan.termMonths} months</dd></div>
            {loan.purchasePrice && <div><dt className="text-stone-500">Purchase Price</dt><dd className="font-medium">{formatCurrency(loan.purchasePrice)}</dd></div>}
            {loan.rehabBudget && <div><dt className="text-stone-500">Rehab Budget</dt><dd className="font-medium">{formatCurrency(loan.rehabBudget)}</dd></div>}
            {loan.ltv && <div><dt className="text-stone-500">LTV</dt><dd className="font-medium">{Number(loan.ltv).toFixed(1)}%</dd></div>}
          </dl>
        </div>

        {/* Property */}
        {loan.property && (
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-sm font-medium text-stone-500 mb-4">Property</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2"><dt className="text-stone-500">Address</dt><dd className="font-medium">{loan.property.address}, {loan.property.city}, {loan.property.state} {loan.property.zip}</dd></div>
              <div><dt className="text-stone-500">Type</dt><dd className="font-medium">{loan.property.propertyType}</dd></div>
              {loan.property.yearBuilt && <div><dt className="text-stone-500">Year Built</dt><dd className="font-medium">{loan.property.yearBuilt}</dd></div>}
              {loan.property.squareFeet && <div><dt className="text-stone-500">Sq Ft</dt><dd className="font-medium">{loan.property.squareFeet.toLocaleString()}</dd></div>}
              {loan.property.bedrooms && <div><dt className="text-stone-500">Beds/Baths</dt><dd className="font-medium">{loan.property.bedrooms}/{loan.property.bathrooms}</dd></div>}
            </dl>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-stone-500 mb-4">Key Dates</h3>
          <dl className="space-y-2 text-sm">
            {loan.applicationDate && <div className="flex justify-between"><dt className="text-stone-500">Application</dt><dd>{formatDate(loan.applicationDate)}</dd></div>}
            {loan.approvalDate && <div className="flex justify-between"><dt className="text-stone-500">Approved</dt><dd>{formatDate(loan.approvalDate)}</dd></div>}
            {loan.fundingDate && <div className="flex justify-between"><dt className="text-stone-500">Funded</dt><dd>{formatDate(loan.fundingDate)}</dd></div>}
            {loan.maturityDate && <div className="flex justify-between"><dt className="text-stone-500">Maturity</dt><dd>{formatDate(loan.maturityDate)}</dd></div>}
            <div className="flex justify-between"><dt className="text-stone-500">Created</dt><dd>{formatDate(loan.createdAt)}</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-stone-500 mb-4">Team</h3>
          <dl className="space-y-2 text-sm">
            {loan.loanOfficer && <div className="flex justify-between"><dt className="text-stone-500">Loan Officer</dt><dd>{loan.loanOfficer.firstName} {loan.loanOfficer.lastName}</dd></div>}
            {loan.processor && <div className="flex justify-between"><dt className="text-stone-500">Processor</dt><dd>{loan.processor.firstName} {loan.processor.lastName}</dd></div>}
            {loan.underwriter && <div className="flex justify-between"><dt className="text-stone-500">Underwriter</dt><dd>{loan.underwriter.firstName} {loan.underwriter.lastName}</dd></div>}
          </dl>
        </div>

        {loan.capitalAllocations?.length > 0 && (
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-sm font-medium text-stone-500 mb-4">Capital Sources</h3>
            <div className="space-y-2">
              {loan.capitalAllocations.map((alloc: any) => (
                <div key={alloc.id} className="flex justify-between text-sm">
                  <span>{alloc.capitalSource.name}</span>
                  <span className="font-medium">{formatCurrency(alloc.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DocsTab({ documents }: { documents: any[] }) {
  if (!documents?.length) {
    return <EmptyState text="No documents uploaded yet" />;
  }
  return (
    <div className="rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-stone-50">
            <th className="px-4 py-3 text-left font-medium text-stone-500">File</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Category</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc: any) => (
            <tr key={doc.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium">{doc.fileName}</td>
              <td className="px-4 py-3 text-stone-500">{doc.category}</td>
              <td className="px-4 py-3">
                <span className={cn("text-xs rounded-full px-2 py-0.5", doc.reviewStatus === "ACCEPTED" ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-600")}>
                  {doc.reviewStatus || "Pending"}
                </span>
              </td>
              <td className="px-4 py-3 text-stone-500 text-xs">{formatDate(doc.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTab({ payments }: { payments: any[] }) {
  if (!payments?.length) {
    return <EmptyState text="No payments scheduled yet" />;
  }
  return (
    <div className="rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-stone-50">
            <th className="px-4 py-3 text-left font-medium text-stone-500">Due Date</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Amount</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Principal</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Interest</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Paid</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((pmt: any) => (
            <tr key={pmt.id} className="border-b last:border-0">
              <td className="px-4 py-3">{formatDate(pmt.dueDate)}</td>
              <td className="px-4 py-3 font-medium">{formatCurrency(pmt.amount)}</td>
              <td className="px-4 py-3 text-stone-500">{formatCurrency(pmt.principalAmount)}</td>
              <td className="px-4 py-3 text-stone-500">{formatCurrency(pmt.interestAmount)}</td>
              <td className="px-4 py-3">
                <span className={cn("text-xs rounded-full px-2 py-0.5", {
                  "bg-green-100 text-green-700": pmt.status === "PAID",
                  "bg-yellow-100 text-yellow-700": pmt.status === "PENDING",
                  "bg-red-100 text-red-700": pmt.status === "LATE" || pmt.status === "NSF",
                  "bg-stone-100 text-stone-600": pmt.status === "SCHEDULED",
                })}>
                  {pmt.status}
                </span>
              </td>
              <td className="px-4 py-3 text-stone-500 text-xs">{pmt.paidDate ? formatDate(pmt.paidDate) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DrawsTab({ draws }: { draws: any[] }) {
  if (!draws?.length) {
    return <EmptyState text="No draw requests yet" />;
  }
  return (
    <div className="rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-stone-50">
            <th className="px-4 py-3 text-left font-medium text-stone-500">Draw #</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Requested</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Approved</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-stone-500">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {draws.map((draw: any) => (
            <tr key={draw.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium">#{draw.drawNumber}</td>
              <td className="px-4 py-3">{formatCurrency(draw.amountRequested)}</td>
              <td className="px-4 py-3">{draw.amountApproved ? formatCurrency(draw.amountApproved) : "-"}</td>
              <td className="px-4 py-3">
                <span className="text-xs rounded-full px-2 py-0.5 bg-stone-100 text-stone-600">{draw.status}</span>
              </td>
              <td className="px-4 py-3 text-stone-500 text-xs">{draw.submittedAt ? formatDate(draw.submittedAt) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConditionsTab({ conditions }: { conditions: any[] }) {
  if (!conditions?.length) {
    return <EmptyState text="No conditions added" />;
  }
  return (
    <div className="space-y-2">
      {conditions.map((cond: any) => (
        <div
          key={cond.id}
          className={cn(
            "rounded-lg border bg-white p-4 flex items-start gap-3",
            cond.isCleared && "opacity-60"
          )}
        >
          <input type="checkbox" checked={cond.isCleared} readOnly className="mt-0.5 rounded" />
          <div>
            <p className={cn("text-sm", cond.isCleared && "line-through")}>{cond.text}</p>
            {cond.category && <p className="text-xs text-stone-400 mt-1">{cond.category}</p>}
            {cond.clearedAt && <p className="text-xs text-green-600 mt-1">Cleared {formatDate(cond.clearedAt)}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityTab({ history }: { history: any[] }) {
  if (!history?.length) {
    return <EmptyState text="No activity yet" />;
  }
  return (
    <div className="space-y-3">
      {history.map((entry: any) => (
        <div key={entry.id} className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 rounded-full bg-[#1E3A5F] shrink-0" />
          <div>
            <p className="text-sm">
              {entry.fromStatus && (
                <>
                  <LoanStatusBadge status={entry.fromStatus as LoanStatus} />
                  <span className="mx-1 text-stone-400">&rarr;</span>
                </>
              )}
              <LoanStatusBadge status={entry.toStatus as LoanStatus} />
            </p>
            {entry.reason && <p className="text-xs text-stone-500 mt-1">{entry.reason}</p>}
            <p className="text-xs text-stone-400 mt-1">{formatRelative(entry.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border bg-white p-8 text-center">
      <p className="text-sm text-stone-500">{text}</p>
    </div>
  );
}
