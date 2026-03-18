"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search,
  Loader2,
  Home,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import type { LoanStatus } from "@prisma/client";

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  SFR: "SFR",
  CONDO: "Condo",
  TOWNHOUSE: "Townhouse",
  DUPLEX: "Duplex",
  TRIPLEX: "Triplex",
  FOURPLEX: "Fourplex",
  MULTIFAMILY_5_PLUS: "Multifamily 5+",
  MIXED_USE: "Mixed Use",
  COMMERCIAL_RETAIL: "Commercial Retail",
  COMMERCIAL_OFFICE: "Commercial Office",
  INDUSTRIAL: "Industrial",
  LAND: "Land",
  MOBILE_HOME: "Mobile Home",
};

export default function PropertiesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["properties", { search, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", page.toString());
      params.set("limit", "25");
      const res = await fetch(`/api/properties?${params}`);
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Properties</h1>
      </div>

      <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by address, city, or parcel..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 rounded-md border bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : !data?.properties?.length ? (
          <div className="p-12 text-center">
            <Home className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No properties found</p>
            <p className="text-xs text-zinc-400 mt-1">
              Properties are created when you add them to a loan.
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Address
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Beds/Baths
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Sq Ft
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Loan
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.properties.map((p: any) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/properties/${p.id}`}
                        className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-zinc-400" />
                          <div>
                            <p>{p.address}</p>
                            <p className="text-xs text-zinc-400">
                              {p.city}, {p.state} {p.zip}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {PROPERTY_TYPE_LABELS[p.propertyType] || p.propertyType}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {p.bedrooms ?? "-"} / {p.bathrooms ? Number(p.bathrooms) : "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {p.squareFeet?.toLocaleString() ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {p.loan ? (
                        <Link
                          href={`/loans/${p.loan.id}`}
                          className="text-brand-600 hover:text-brand-700 dark:text-brand-400 text-xs"
                        >
                          {p.loan.loanNumber}
                        </Link>
                      ) : (
                        <span className="text-zinc-400 text-xs">No loan</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.loan ? (
                        <LoanStatusBadge status={p.loan.status as LoanStatus} />
                      ) : (
                        <span className="text-zinc-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500">
                  {(page - 1) * data.limit + 1}-
                  {Math.min(page * data.limit, data.total)} of {data.total}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
