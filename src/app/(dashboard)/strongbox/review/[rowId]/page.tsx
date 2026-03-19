"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, History, Layers3 } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type ValidationIssue = {
  code?: string;
  field?: string;
  message?: string;
  severity?: string;
};

type RemediationAuditEntry = {
  id: string;
  entity_type: string;
  action_type: string;
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  actor_id: string | null;
  note: string | null;
  created_at: string;
};

type QueueRow = {
  id: string;
  status: string;
  source_sheet_name: string;
  source_row_number: number | null;
  source_row_key: string | null;
  validation_errors: ValidationIssue[];
  normalized_payload: Record<string, unknown>;
  merged_payload: Record<string, unknown>;
  remediation_audits: RemediationAuditEntry[];
  batch: {
    id: string;
    source_sheet_family: string;
    source_sheet_name: string;
  };
};

type QueueResponse = {
  queue: QueueRow[];
};

function formatValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "number") {
    return Math.abs(value) >= 1000 ? formatCurrencyCompact(value) : String(value);
  }
  return String(value);
}

function formatAuditLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function StrongboxReviewRowDetailPage() {
  const params = useParams<{ rowId: string }>();
  const rowId = String(params.rowId || "");

  const query = useQuery<QueueResponse>({
    queryKey: ["strongbox-import-review-row", rowId],
    queryFn: async () => {
      const res = await fetch(`/api/strongbox/import-review?rowId=${rowId}`);
      if (!res.ok) throw new Error("Failed to load remediation row");
      return res.json();
    },
    enabled: Boolean(rowId),
  });

  const row = query.data?.queue?.[0];
  const mergedEntries = row ? Object.entries(row.merged_payload) : [];
  const normalizedEntries = row ? Object.entries(row.normalized_payload) : [];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(195,55,50,0.12),_transparent_34%),linear-gradient(180deg,#ffffff_0%,#fbf7f3_100%)] p-6 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#C33732]">Remediation Row Detail</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{row?.source_row_key || rowId}</h1>
            <p className="text-sm text-zinc-600">{row?.batch.source_sheet_family} / {row?.batch.source_sheet_name}</p>
          </div>
          <Link href={row ? `/strongbox/review?batchId=${row.batch.id}` : "/strongbox/review"} className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900">
            <ArrowLeft className="h-4 w-4" /> Back to remediation
          </Link>
        </div>
      </section>

      {query.isLoading || !row ? (
        <section className="rounded-[24px] border border-black/10 bg-white p-8 text-sm text-zinc-500">Loading remediation row...</section>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <article className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
              <div className="mb-4 flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-[#C33732]" />
                <h2 className="text-xl font-semibold text-zinc-950">Current payload</h2>
              </div>
              <div className="space-y-2 text-sm">
                {mergedEntries.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-black/6 bg-[#faf8f5] px-3 py-2.5">
                    <span className="text-zinc-500">{key.replace(/_/g, " ")}</span>
                    <span className="text-right font-medium text-zinc-950">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
              <div className="mb-4 flex items-center gap-2">
                <History className="h-4 w-4 text-[#C33732]" />
                <h2 className="text-xl font-semibold text-zinc-950">Relational audit trail</h2>
              </div>
              <div className="space-y-3">
                {row.remediation_audits.length === 0 ? (
                  <p className="text-sm text-zinc-500">No audit entries recorded for this row yet.</p>
                ) : (
                  row.remediation_audits.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-black/8 bg-[#faf8f5] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold capitalize text-zinc-950">{formatAuditLabel(entry.action_type)}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                            <span>{entry.field_name || "event"}</span>
                            <span className="text-zinc-300">/</span>
                            <span>{formatAuditLabel(entry.entity_type)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString()}</p>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div className="rounded-2xl border border-black/6 bg-white px-3 py-2.5">
                          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Old value</p>
                          <p className="mt-1 text-sm text-zinc-950">{formatValue(entry.old_value)}</p>
                        </div>
                        <div className="rounded-2xl border border-black/6 bg-white px-3 py-2.5">
                          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">New value</p>
                          <p className="mt-1 text-sm text-zinc-950">{formatValue(entry.new_value)}</p>
                        </div>
                      </div>
                      {entry.note ? <p className="mt-3 text-sm text-zinc-600">{entry.note}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
              <h2 className="text-xl font-semibold text-zinc-950">Validation issues</h2>
              <div className="mt-4 space-y-2">
                {row.validation_errors.map((issue, index) => (
                  <div key={`${issue.code}-${index}`} className="rounded-2xl border border-black/8 bg-[#faf8f5] p-4">
                    <p className="font-medium text-zinc-950">{issue.message || issue.code}</p>
                    {issue.field ? <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">{issue.field}</p> : null}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
              <h2 className="text-xl font-semibold text-zinc-950">Normalized payload</h2>
              <div className="mt-4 space-y-2 text-sm">
                {normalizedEntries.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-black/6 bg-[#faf8f5] px-3 py-2.5">
                    <span className="text-zinc-500">{key.replace(/_/g, " ")}</span>
                    <span className="text-right font-medium text-zinc-950">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}