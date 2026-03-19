"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type BorrowerDetail = {
  id: string;
  legal_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  notes: string | null;
  loans: Array<{
    id: string;
    loan_stage: string;
    loan_status: string;
    principal_total: number | null;
    property: { full_address: string | null } | null;
  }>;
  tax_1098_records: Array<{
    id: string;
    loans_closed_2022_count: number;
    loans_closed_2023_count: number;
    active_or_cashout_count: number;
    total_loan_count: number;
    terms_reference: string | null;
    property_address: string | null;
    review_flag: boolean;
  }>;
};

export default function StrongboxBorrowerDetailPage() {
  const params = useParams<{ id: string }>();

  const query = useQuery<{ borrower: BorrowerDetail }>({
    queryKey: ["strongbox-borrower", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/strongbox/borrowers/${params.id}`);
      if (!res.ok) throw new Error("Failed to load borrower");
      return res.json();
    },
  });

  if (query.isLoading) return <p className="text-sm text-zinc-500">Loading borrower...</p>;
  if (!query.data?.borrower) return <p className="text-sm text-red-500">Borrower not found.</p>;

  const borrower = query.data.borrower;
  const activeLoans = borrower.loans.filter((l) => l.loan_stage === "ACTIVE");
  const historical = borrower.loans.filter((l) => l.loan_stage === "CLOSED");

  return (
    <div className="space-y-4">
      <Link href="/strongbox" className="text-sm text-zinc-500 hover:text-black">Back to StrongBox dashboard</Link>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <h1 className="text-2xl font-semibold text-black">{borrower.legal_name}</h1>
        <p className="text-sm text-zinc-600">{borrower.contact_name || "No contact name"}</p>
        <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-zinc-700 md:grid-cols-3">
          <p>Email: {borrower.email || "-"}</p>
          <p>Phone: {borrower.phone || "-"}</p>
          <p>Mailing Address: {borrower.mailing_address || "-"}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold text-black">Active Loans</h2>
          <div className="mt-2 space-y-2 text-sm">
            {activeLoans.length === 0 && <p className="text-zinc-500">No active loans.</p>}
            {activeLoans.map((loan) => (
              <div key={loan.id} className="rounded-md border border-black/10 p-2">
                <p className="font-medium">{loan.property?.full_address || "No address"}</p>
                <p className="text-zinc-600">{formatCurrencyCompact(Number(loan.principal_total || 0))} | {loan.loan_status.toLowerCase()}</p>
                <Link href={`/strongbox/loans/${loan.id}`} className="text-xs text-[#C33732]">Open loan</Link>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold text-black">Historical Closed Loans</h2>
          <div className="mt-2 space-y-2 text-sm">
            {historical.length === 0 && <p className="text-zinc-500">No closed history.</p>}
            {historical.map((loan) => (
              <div key={loan.id} className="rounded-md border border-black/10 p-2">
                <p className="font-medium">{loan.property?.full_address || "No address"}</p>
                <p className="text-zinc-600">{formatCurrencyCompact(Number(loan.principal_total || 0))} | {loan.loan_status.toLowerCase()}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <h2 className="text-sm font-semibold text-black">Tax 1098 Prep References</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-[0.12em] text-zinc-500">
                <th className="px-2 py-2 text-left">2022</th>
                <th className="px-2 py-2 text-left">2023</th>
                <th className="px-2 py-2 text-left">Active/CashOut</th>
                <th className="px-2 py-2 text-left">Total</th>
                <th className="px-2 py-2 text-left">Terms</th>
                <th className="px-2 py-2 text-left">Review</th>
              </tr>
            </thead>
            <tbody>
              {borrower.tax_1098_records.map((row) => (
                <tr key={row.id} className="border-b border-black/10 last:border-0">
                  <td className="px-2 py-2">{row.loans_closed_2022_count}</td>
                  <td className="px-2 py-2">{row.loans_closed_2023_count}</td>
                  <td className="px-2 py-2">{row.active_or_cashout_count}</td>
                  <td className="px-2 py-2">{row.total_loan_count}</td>
                  <td className="px-2 py-2">{row.terms_reference || "-"}</td>
                  <td className="px-2 py-2">{row.review_flag ? "Flagged" : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4 text-sm text-zinc-700">
        <h2 className="text-sm font-semibold text-black">Notes</h2>
        <p className="mt-2">{borrower.notes || "No borrower notes."}</p>
      </section>
    </div>
  );
}
