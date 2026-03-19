"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyCompact } from "@/lib/utils/currency";

export default function StrongboxLoansPage() {
  const query = useQuery<{ loans: Array<{ id: string; loan_stage: string; loan_status: string; principal_total: number | null; borrower: { legal_name: string }; property: { full_address: string | null } | null }> }>({
    queryKey: ["strongbox-loans-list"],
    queryFn: async () => {
      const res = await fetch("/api/strongbox/loans?limit=300");
      if (!res.ok) throw new Error("Failed to load loans");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-black/10 bg-white p-4">
        <h1 className="text-2xl font-semibold">Loans</h1>
        <p className="text-sm text-zinc-600">Pipeline, upcoming, active, and closed loans from normalized records.</p>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        {query.isLoading ? (
          <p className="text-sm text-zinc-500">Loading loans...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
                <th className="px-3 py-2 text-left">Borrower</th>
                <th className="px-3 py-2 text-left">Property</th>
                <th className="px-3 py-2 text-left">Stage</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Principal</th>
                <th className="px-3 py-2 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.loans || []).map((loan) => (
                <tr key={loan.id} className="border-b border-black/10 last:border-0">
                  <td className="px-3 py-2">{loan.borrower.legal_name}</td>
                  <td className="px-3 py-2 text-zinc-600">{loan.property?.full_address || "-"}</td>
                  <td className="px-3 py-2 capitalize">{loan.loan_stage.toLowerCase()}</td>
                  <td className="px-3 py-2 capitalize">{loan.loan_status.toLowerCase()}</td>
                  <td className="px-3 py-2">{formatCurrencyCompact(Number(loan.principal_total || 0))}</td>
                  <td className="px-3 py-2 text-right"><Link href={`/strongbox/loans/${loan.id}`} className="text-[#C33732]">Detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
