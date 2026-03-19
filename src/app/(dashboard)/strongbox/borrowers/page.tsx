"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

export default function StrongboxBorrowersPage() {
  const query = useQuery<{ borrowers: Array<{ id: string; legal_name: string; contact_name: string | null; email: string | null; phone: string | null; loans: Array<{ loan_stage: string }> }> }>({
    queryKey: ["strongbox-borrowers"],
    queryFn: async () => {
      const res = await fetch("/api/strongbox/borrowers");
      if (!res.ok) throw new Error("Failed to load borrowers");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-black/10 bg-white p-4">
        <h1 className="text-2xl font-semibold">Borrowers / Clients</h1>
        <p className="text-sm text-zinc-600">Normalized borrower profiles with active and historical loan context.</p>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        {query.isLoading ? (
          <p className="text-sm text-zinc-500">Loading borrowers...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-zinc-50 text-xs uppercase tracking-[0.12em] text-zinc-500">
                <th className="px-3 py-2 text-left">Legal Name</th>
                <th className="px-3 py-2 text-left">Contact</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Active Loans</th>
                <th className="px-3 py-2 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.borrowers || []).map((b) => (
                <tr key={b.id} className="border-b border-black/10 last:border-0">
                  <td className="px-3 py-2">{b.legal_name}</td>
                  <td className="px-3 py-2">{b.contact_name || "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{b.email || "-"}</td>
                  <td className="px-3 py-2 text-zinc-600">{b.phone || "-"}</td>
                  <td className="px-3 py-2">{b.loans.filter((l) => l.loan_stage === "ACTIVE").length}</td>
                  <td className="px-3 py-2 text-right"><Link href={`/strongbox/borrowers/${b.id}`} className="text-[#C33732]">Detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
