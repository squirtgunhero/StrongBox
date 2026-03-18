"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark,
  Plus,
  Loader2,
  DollarSign,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  LINE_OF_CREDIT: { label: "Line of Credit", color: "text-[#3B82F6] bg-blue-500/10" },
  PRIVATE_INVESTOR: { label: "Private Investor", color: "text-purple-600 bg-purple-50950" },
  FUND: { label: "Fund", color: "text-emerald-600 bg-emerald-50950" },
  OPERATING_CAPITAL: { label: "Operating", color: "text-amber-600 bg-amber-50950" },
};

export default function CapitalPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "LINE_OF_CREDIT",
    creditLimit: "",
    interestRate: "",
    bankName: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["capital"],
    queryFn: async () => {
      const res = await fetch("/api/capital?includeAllocations=true");
      if (!res.ok) throw new Error("Failed to fetch capital sources");
      return res.json();
    },
  });

  const createSource = useMutation({
    mutationFn: async (sourceData: Record<string, unknown>) => {
      const res = await fetch("/api/capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceData),
      });
      if (!res.ok) throw new Error("Failed to create capital source");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capital"] });
      setShowCreate(false);
      setForm({ name: "", type: "LINE_OF_CREDIT", creditLimit: "", interestRate: "", bankName: "", notes: "" });
    },
  });

  const sources = data?.capitalSources || [];
  const totals = data?.totals || { totalLimit: 0, totalDeployed: 0, totalAvailable: 0 };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Capital Sources</h1>
          <p className="text-sm text-zinc-500 mt-1">{sources.length} sources</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" /> Add Source
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2">
              <Landmark className="h-4 w-4 text-[#3B82F6]" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Capacity</p>
              <p className="text-xl font-bold">{formatCurrency(totals.totalLimit)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-50 p-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Deployed</p>
              <p className="text-xl font-bold">{formatCurrency(totals.totalDeployed)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-50 p-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Available</p>
              <p className="text-xl font-bold text-emerald-600">
                {formatCurrency(totals.totalAvailable)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Add Capital Source</h3>
            <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-400">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Main LOC"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="LINE_OF_CREDIT">Line of Credit</option>
                <option value="PRIVATE_INVESTOR">Private Investor</option>
                <option value="FUND">Fund</option>
                <option value="OPERATING_CAPITAL">Operating Capital</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Credit Limit / Total</label>
              <input
                type="number"
                step="0.01"
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Interest Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Bank Name</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={() => createSource.mutate(form)}
              disabled={!form.name || createSource.isPending}
              className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Capital Sources List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-xl p-12 text-center">
          <Landmark className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No capital sources configured</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source: any) => {
            const typeCfg = TYPE_CONFIG[source.type] || TYPE_CONFIG.LINE_OF_CREDIT;
            const limit = Number(source.creditLimit || 0);
            const deployed = Number(source.totalDeployed || 0);
            const available = limit - deployed;
            const utilization = limit > 0 ? (deployed / limit) * 100 : 0;

            return (
              <div
                key={source.id}
                className="rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{source.name}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          typeCfg.color
                        )}
                      >
                        {typeCfg.label}
                      </span>
                      {!source.isActive && (
                        <span className="text-[10px] text-zinc-500 bg-white/10 px-1.5 py-0.5 rounded">
                          inactive
                        </span>
                      )}
                    </div>
                    {source.bankName && (
                      <p className="text-xs text-zinc-500 mt-0.5">{source.bankName}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(limit)}</p>
                    {source.interestRate && (
                      <p className="text-xs text-zinc-500">
                        {Number(source.interestRate).toFixed(2)}% rate
                      </p>
                    )}
                  </div>
                </div>

                {/* Utilization Bar */}
                {limit > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Deployed: {formatCurrency(deployed)}</span>
                      <span>Available: {formatCurrency(available)}</span>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-2">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all",
                          utilization > 90
                            ? "bg-red-500"
                            : utilization > 70
                            ? "bg-amber-500"
                            : "bg-[#3B82F6]"
                        )}
                        style={{ width: `${Math.min(100, utilization)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 text-right">
                      {utilization.toFixed(0)}% utilized
                    </p>
                  </div>
                )}

                {/* Allocations */}
                {source.allocations && source.allocations.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-zinc-500 font-medium mb-2">
                      Active Allocations ({source.allocations.length})
                    </p>
                    <div className="space-y-1">
                      {source.allocations.slice(0, 5).map((alloc: any) => (
                        <div
                          key={alloc.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-[#3B82F6]">
                            {alloc.loan.loanNumber}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(alloc.amount)}
                          </span>
                        </div>
                      ))}
                      {source.allocations.length > 5 && (
                        <p className="text-[10px] text-zinc-500">
                          +{source.allocations.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
