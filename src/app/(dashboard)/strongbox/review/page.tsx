"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock3, Flag, RefreshCcw, Send, ShieldAlert } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/utils/currency";

type ValidationIssue = {
  code?: string;
  field?: string;
  message?: string;
  severity?: string;
  suggestedValue?: unknown;
  metadata?: Record<string, unknown>;
};

type CorrectionAuditEntry = {
  action?: string;
  appliedAt?: string;
  appliedBy?: string | null;
  note?: string | null;
  fields?: string[];
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
  missing_critical: boolean;
  validation_errors: ValidationIssue[];
  issue_codes: string[];
  remediation_labels: string[];
  normalized_payload: Record<string, unknown>;
  merged_payload: Record<string, unknown>;
  correction_values: Record<string, unknown>;
  correction_history: CorrectionAuditEntry[];
  remediation_audits: RemediationAuditEntry[];
  published_at: string | null;
  updated_at: string;
  batch: {
    id: string;
    source_sheet_family: string;
    source_sheet_name: string;
    status: string;
    created_at: string;
  };
};

type QueueResponse = {
  queue: QueueRow[];
  summary: {
    total: number;
    invalid: number;
    needsReview: number;
    corrected: number;
    byFamily: Record<string, number>;
  };
};

type DraftField = {
  key: string;
  label: string;
  type: "text" | "currency" | "date" | "select";
  options?: string[];
};

type SortMode = "priority_desc" | "updated_desc" | "source_asc";

const ISSUE_FIELD_MAP: Record<string, DraftField[]> = {
  missing_arv: [{ key: "arv", label: "ARV", type: "currency" }],
  high_ltv: [
    { key: "arv", label: "ARV", type: "currency" },
    { key: "principal_total", label: "Principal", type: "currency" },
  ],
  exceeded_draw_limits: [
    { key: "amount_requested", label: "Requested Draw", type: "currency" },
    { key: "approved_amount", label: "Approved Draw", type: "currency" },
  ],
  unmapped_market: [
    { key: "full_address", label: "Address", type: "text" },
    { key: "city", label: "City", type: "text" },
    { key: "state", label: "State", type: "text" },
    { key: "market_name", label: "Market", type: "text" },
  ],
  matured_unpaid: [
    { key: "payoff_date", label: "Payoff Date", type: "date" },
    { key: "maturity_date", label: "Maturity Date", type: "date" },
    { key: "loan_status", label: "Loan Status", type: "select", options: ["pending", "approved", "funded", "active", "matured", "paid_off", "closed"] },
  ],
  broken_tax_prep_reference: [
    { key: "borrower_name", label: "Borrower", type: "text" },
    { key: "source_reference", label: "Source Reference", type: "text" },
    { key: "terms_reference", label: "Terms Reference", type: "text" },
    { key: "property_address", label: "Property Address", type: "text" },
  ],
};

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "invalid") return "border-red-200 bg-red-50 text-red-700";
  if (normalized === "needs_review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "corrected") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function issueTone(severity?: string) {
  return severity === "critical"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function formatValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "number") {
    return Math.abs(value) >= 1000 ? formatCurrencyCompact(value) : String(value);
  }
  return String(value);
}

function normalizeDraftValue(field: DraftField, value: string) {
  if (value.trim() === "") return null;
  if (field.type === "currency") {
    const parsed = Number(value.replace(/[$,%\s,]/g, ""));
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}

function getInputValue(field: DraftField, value: unknown) {
  if (value == null) return "";
  if (field.type === "date") {
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }
  return String(value);
}

function formatAuditLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getDraftFields(row: QueueRow): DraftField[] {
  const mapped = row.issue_codes.flatMap((issueCode) => ISSUE_FIELD_MAP[issueCode] || []);
  const unique = new Map<string, DraftField>();

  for (const field of mapped) {
    unique.set(field.key, field);
  }

  if (unique.size === 0 && row.validation_errors.length > 0) {
    for (const issue of row.validation_errors) {
      if (issue.field) {
        unique.set(issue.field, {
          key: issue.field,
          label: issue.field.replace(/_/g, " "),
          type: issue.field.includes("date") ? "date" : issue.field.includes("amount") || issue.field.includes("arv") ? "currency" : "text",
        });
      }
    }
  }

  return Array.from(unique.values());
}

function isPublishableStatus(status: string) {
  return ["VALID", "CORRECTED", "PUBLISHED"].includes(status.toUpperCase());
}

function getIssueCounts(row: QueueRow) {
  return row.validation_errors.reduce(
    (acc, issue) => {
      if (issue.severity === "critical") {
        acc.critical += 1;
      } else {
        acc.warning += 1;
      }
      return acc;
    },
    { critical: 0, warning: 0 }
  );
}

function getRowPriorityScore(row: QueueRow) {
  const issueCounts = getIssueCounts(row);
  return (row.missing_critical ? 1000 : 0) + issueCounts.critical * 100 + issueCounts.warning * 10 + (isPublishableStatus(row.status) ? 0 : 5);
}

function compareRows(left: QueueRow, right: QueueRow, sortMode: SortMode) {
  if (sortMode === "updated_desc") {
    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  }

  if (sortMode === "source_asc") {
    return `${left.source_sheet_name}:${left.source_row_number || 0}:${left.source_row_key || ""}`.localeCompare(
      `${right.source_sheet_name}:${right.source_row_number || 0}:${right.source_row_key || ""}`
    );
  }

  const priorityDelta = getRowPriorityScore(right) - getRowPriorityScore(left);
  if (priorityDelta !== 0) return priorityDelta;

  return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
}

function getIssueBreakdown(rows: QueueRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const issueCode of row.issue_codes) {
      counts.set(issueCode, (counts.get(issueCode) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([issueCode, count]) => ({ issueCode, count }));
}

function StrongboxImportReviewContent() {
  const searchParams = useSearchParams();
  const batchScope = searchParams.get("batchId")?.trim() || "";
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [issueFilter, setIssueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("priority_desc");
  const [collapsedRows, setCollapsedRows] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const query = useQuery<QueueResponse>({
    queryKey: ["strongbox-import-review", batchScope],
    queryFn: async () => {
      const queryString = batchScope ? `?batchId=${batchScope}` : "";
      const res = await fetch(`/api/strongbox/import-review${queryString}`);
      if (!res.ok) throw new Error("Failed to load review queue");
      return res.json();
    },
  });

  const correctRow = useMutation({
    mutationFn: async ({ row, values, note }: { row: QueueRow; values: Record<string, string>; note: string }) => {
      const fields = getDraftFields(row);
      const normalizedCorrection = Object.fromEntries(
        Object.entries(values)
          .filter(([, value]) => value.trim() !== "")
          .map(([key, value]) => {
            const field = fields.find((entry) => entry.key === key) || { key, label: key, type: "text" as const };
            return [key, normalizeDraftValue(field, value)];
          })
      );

      const res = await fetch("/api/import/strongbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct",
          batchId: row.batch.id,
          rowId: row.id,
          adminCorrection: normalizedCorrection,
          note,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Correction failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strongbox-import-review"] });
      queryClient.invalidateQueries({ queryKey: ["strongbox-dashboard"] });
    },
  });

  const publishRow = useMutation({
    mutationFn: async ({ rowId, batchId, note }: { rowId: string; batchId: string; note: string }) => {
      const res = await fetch("/api/import/strongbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-row", rowId, batchId, publish: true, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strongbox-import-review"] });
      queryClient.invalidateQueries({ queryKey: ["strongbox-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["strongbox-risk-flags"] });
    },
  });

  const publishBatch = useMutation({
    mutationFn: async ({ batchId, note }: { batchId: string; note: string }) => {
      const res = await fetch("/api/import/strongbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-batch", batchId, publish: true, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strongbox-import-review"] });
      queryClient.invalidateQueries({ queryKey: ["strongbox-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["strongbox-risk-flags"] });
    },
  });

  const filteredRows = useMemo(() => {
    const rows = query.data?.queue || [];
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status.toLowerCase() === statusFilter;
      const matchesFamily = familyFilter === "all" || row.batch.source_sheet_family === familyFilter;
      const matchesIssue = issueFilter === "all" || row.issue_codes.includes(issueFilter);
      const haystack = [
        row.batch.source_sheet_name,
        row.source_row_key,
        row.merged_payload.borrower_name,
        row.merged_payload.full_address,
        row.merged_payload.account_name,
        row.merged_payload.property_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      return matchesStatus && matchesFamily && matchesIssue && matchesSearch;
    });
  }, [familyFilter, issueFilter, query.data?.queue, search, statusFilter]);

  const groupedRows = useMemo(() => {
    const grouped = filteredRows.reduce<Record<string, { batch: QueueRow["batch"]; rows: QueueRow[] }>>((acc, row) => {
      if (!acc[row.batch.id]) {
        acc[row.batch.id] = { batch: row.batch, rows: [] };
      }
      acc[row.batch.id].rows.push(row);
      return acc;
    }, {});

    Object.values(grouped).forEach((group) => {
      group.rows.sort((left, right) => compareRows(left, right, sortMode));
    });

    return grouped;
  }, [filteredRows, sortMode]);

  const readyRowsCount = useMemo(() => {
    return filteredRows.filter((row) => isPublishableStatus(row.status)).length;
  }, [filteredRows]);

  const blockedRowsCount = useMemo(() => {
    return filteredRows.filter((row) => !isPublishableStatus(row.status)).length;
  }, [filteredRows]);

  const visibleRowIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);

  const allVisibleCollapsed = useMemo(() => {
    return visibleRowIds.length > 0 && visibleRowIds.every((rowId) => collapsedRows[rowId]);
  }, [collapsedRows, visibleRowIds]);

  const criticalRowsCount = useMemo(() => {
    return filteredRows.filter((row) => getIssueCounts(row).critical > 0 || row.missing_critical).length;
  }, [filteredRows]);

  const warningRowsCount = useMemo(() => {
    return filteredRows.filter((row) => getIssueCounts(row).critical === 0 && getIssueCounts(row).warning > 0).length;
  }, [filteredRows]);

  const families = useMemo(() => {
    return Array.from(new Set((query.data?.queue || []).map((row) => row.batch.source_sheet_family))).sort();
  }, [query.data?.queue]);

  const issueCodes = useMemo(() => {
    return Array.from(new Set((query.data?.queue || []).flatMap((row) => row.issue_codes))).sort();
  }, [query.data?.queue]);

  const updateDraft = (rowId: string, key: string, value: string) => {
    setDrafts((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] || {}),
        [key]: value,
      },
    }));
  };

  const toggleRowCollapsed = (rowId: string) => {
    setCollapsedRows((current) => ({
      ...current,
      [rowId]: !current[rowId],
    }));
  };

  const setVisibleRowsCollapsed = (collapsed: boolean) => {
    setCollapsedRows((current) => ({
      ...current,
      ...Object.fromEntries(visibleRowIds.map((rowId) => [rowId, collapsed])),
    }));
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(195,55,50,0.14),_transparent_38%),linear-gradient(180deg,#ffffff_0%,#fbf7f3_100%)] p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#C33732]">StrongBox Remediation</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Admin review workflow</h1>
            <p className="max-w-3xl text-sm leading-6 text-zinc-600">
              Correct workbook import defects inline, keep correction history on each row, and republish validated data back into the StrongBox operational models.
            </p>
            {batchScope ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Scoped to import batch {batchScope}</p>
            ) : null}
          </div>
          <div className="grid min-w-[280px] flex-1 grid-cols-2 gap-3 xl:max-w-[520px]">
            <article className="rounded-2xl border border-white/70 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                <ShieldAlert className="h-4 w-4 text-red-600" /> Invalid
              </div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{query.data?.summary.invalid || 0}</p>
            </article>
            <article className="rounded-2xl border border-white/70 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Needs Review
              </div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{query.data?.summary.needsReview || 0}</p>
            </article>
            <article className="rounded-2xl border border-white/70 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                <RefreshCcw className="h-4 w-4 text-blue-600" /> Corrected
              </div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{query.data?.summary.corrected || 0}</p>
            </article>
            <article className="rounded-2xl border border-white/70 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                <Clock3 className="h-4 w-4 text-zinc-600" /> Open Queue
              </div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{filteredRows.length}</p>
            </article>
            <article className="rounded-2xl border border-white/70 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Publish Ready
              </div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{readyRowsCount}</p>
            </article>
            <article className="rounded-2xl border border-white/70 bg-white/90 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                <Flag className="h-4 w-4 text-zinc-600" /> Blocked
              </div>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">{blockedRowsCount}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,0.7fr))]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search borrower, account, address, or source row"
            className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none transition focus:border-[#C33732]/40"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none">
            <option value="all">All statuses</option>
            <option value="invalid">Invalid</option>
            <option value="needs_review">Needs review</option>
            <option value="corrected">Corrected</option>
            <option value="published">Published</option>
          </select>
          <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)} className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none">
            <option value="all">All families</option>
            {families.map((family) => (
              <option key={family} value={family}>{family}</option>
            ))}
          </select>
          <select value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)} className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-3 text-sm outline-none">
            <option value="all">All issues</option>
            {issueCodes.map((issueCode) => (
              <option key={issueCode} value={issueCode}>{issueCode.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Sort rows
            </label>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="rounded-2xl border border-black/10 bg-[#faf8f5] px-4 py-2.5 text-sm outline-none">
              <option value="priority_desc">Highest priority first</option>
              <option value="updated_desc">Recently updated first</option>
              <option value="source_asc">Source row order</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setVisibleRowsCollapsed(true)} disabled={visibleRowIds.length === 0 || allVisibleCollapsed} className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50">
              Collapse all visible
            </button>
            <button type="button" onClick={() => setVisibleRowsCollapsed(false)} disabled={visibleRowIds.length === 0 || !allVisibleCollapsed} className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50">
              Expand all visible
            </button>
          </div>
        </div>
      </section>

      <section className="sticky top-4 z-10 rounded-[24px] border border-black/10 bg-white/95 p-4 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">{criticalRowsCount} critical rows</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">{warningRowsCount} warning rows</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">{readyRowsCount} ready to publish</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("invalid");
                setSortMode("priority_desc");
                setVisibleRowsCollapsed(false);
              }}
              className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-zinc-700"
            >
              Focus critical
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("needs_review");
                setSortMode("priority_desc");
                setVisibleRowsCollapsed(false);
              }}
              className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-zinc-700"
            >
              Focus review
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setIssueFilter("all");
                setFamilyFilter("all");
                setSearch("");
              }}
              className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-zinc-700"
            >
              Reset filters
            </button>
          </div>
        </div>
      </section>

      {query.isLoading ? (
        <div className="rounded-[24px] border border-black/10 bg-white p-8 text-sm text-zinc-500">Loading remediation queue...</div>
      ) : Object.values(groupedRows).length === 0 ? (
        <div className="rounded-[24px] border border-black/10 bg-white p-8 text-sm text-zinc-500">No rows match the current filters.</div>
      ) : (
        Object.values(groupedRows).map(({ batch, rows }) => (
          <section key={batch.id} className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
            {(() => {
              const readyCount = rows.filter((row) => isPublishableStatus(row.status)).length;
              const blockedCount = rows.length - readyCount;
              const publishedCount = rows.filter((row) => row.status === "PUBLISHED").length;
              const issueBreakdown = getIssueBreakdown(rows).slice(0, 6);

              return (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{batch.source_sheet_family}</p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-950">{batch.source_sheet_name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{rows.length} remediation rows in this batch</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">{readyCount} ready</span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">{blockedCount} blocked</span>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">{publishedCount} published</span>
                </div>
                {issueBreakdown.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                    {issueBreakdown.map((entry) => (
                      <button
                        key={`${batch.id}-${entry.issueCode}`}
                        type="button"
                        onClick={() => {
                          setIssueFilter(entry.issueCode);
                          setVisibleRowsCollapsed(false);
                        }}
                        className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-zinc-600 transition hover:border-black/20 hover:bg-zinc-50"
                      >
                        {entry.issueCode.replace(/_/g, " ")} ({entry.count})
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => publishBatch.mutate({ batchId: batch.id, note: "Batch publish from remediation workflow" })}
                disabled={publishBatch.isPending || readyCount === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {publishBatch.isPending ? "Publishing..." : `Publish ready rows (${readyCount})`}
              </button>
            </div>
              );
            })()}

            <div className="space-y-4">
              {rows.map((row) => {
                const rowDraft = drafts[row.id] || {};
                const rowNote = notes[row.id] || "";
                const draftFields = getDraftFields(row);
                const isPublishable = isPublishableStatus(row.status);
                const isCollapsed = Boolean(collapsedRows[row.id]);
                const issueCounts = getIssueCounts(row);
                const primaryLabel = String(
                  row.merged_payload.borrower_name ||
                  row.merged_payload.account_name ||
                  row.merged_payload.property_address ||
                  row.merged_payload.full_address ||
                  row.source_row_key ||
                  row.id
                );

                return (
                  <article key={row.id} className="rounded-[22px] border border-black/10 bg-[#fcfbfa] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(row.status)}`}>
                            {row.status.replace(/_/g, " ")}
                          </span>
                          <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                            Row {row.source_row_number || "-"}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${isPublishable ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                            {isPublishable ? "Publish ready" : "Correction required"}
                          </span>
                          {row.published_at ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                              Published
                            </span>
                          ) : null}
                          {issueCounts.critical > 0 ? (
                            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">
                              {issueCounts.critical} critical
                            </span>
                          ) : null}
                          {issueCounts.warning > 0 ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                              {issueCounts.warning} warning
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-lg font-semibold text-zinc-950">{primaryLabel}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                          <p>{row.source_row_key || "No source key"}</p>
                          <span>Updated {new Date(row.updated_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleRowCollapsed(row.id)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-black/20 hover:bg-zinc-50"
                        >
                          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          {isCollapsed ? "Expand" : "Collapse"}
                        </button>
                        <Link
                          href={`/strongbox/review/${row.id}`}
                          className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-black/20 hover:bg-zinc-50"
                        >
                          Row detail
                        </Link>
                        <button
                          onClick={() => publishRow.mutate({ rowId: row.id, batchId: row.batch.id, note: rowNote })}
                          disabled={publishRow.isPending || !isPublishable}
                          className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:border-black/20 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" /> {publishRow.isPending ? "Publishing..." : row.published_at ? "Republish row" : "Publish row"}
                        </button>
                      </div>
                    </div>

                    {isCollapsed ? null : (
                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {row.validation_errors.map((issue, index) => (
                            <span key={`${row.id}-${issue.code}-${index}`} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${issueTone(issue.severity)}`}>
                              {issue.code?.replace(/_/g, " ") || issue.message}
                            </span>
                          ))}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          {draftFields.map((field) => {
                            const currentValue = rowDraft[field.key] ?? getInputValue(field, row.correction_values[field.key] ?? row.merged_payload[field.key]);
                            return (
                              <label key={field.key} className="space-y-1.5 text-sm text-zinc-600">
                                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{field.label}</span>
                                {field.type === "select" ? (
                                  <select
                                    value={currentValue}
                                    onChange={(event) => updateDraft(row.id, field.key, event.target.value)}
                                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#C33732]/40"
                                  >
                                    <option value="">Select</option>
                                    {field.options?.map((option) => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={field.type === "date" ? "date" : "text"}
                                    value={currentValue}
                                    onChange={(event) => updateDraft(row.id, field.key, event.target.value)}
                                    className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#C33732]/40"
                                  />
                                )}
                              </label>
                            );
                          })}
                        </div>

                        <label className="block space-y-1.5 text-sm text-zinc-600">
                          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Correction Note</span>
                          <textarea
                            value={rowNote}
                            onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                            rows={3}
                            placeholder="Document what changed and why"
                            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#C33732]/40"
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => correctRow.mutate({ row, values: rowDraft, note: rowNote })}
                            disabled={correctRow.isPending}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#C33732] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#A52F2B] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Flag className="h-4 w-4" /> {correctRow.isPending ? "Saving..." : "Save correction"}
                          </button>
                          {(correctRow.isError || publishRow.isError || publishBatch.isError) ? (
                            <p className="self-center text-sm text-red-600">
                              {(correctRow.error as Error | null)?.message || (publishRow.error as Error | null)?.message || (publishBatch.error as Error | null)?.message}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-black/8 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Current values</p>
                          <dl className="mt-3 space-y-2 text-sm">
                            {draftFields.length > 0 ? draftFields.map((field) => (
                              <div key={`${row.id}-${field.key}-value`} className="flex items-center justify-between gap-3 border-b border-black/6 pb-2 last:border-0 last:pb-0">
                                <dt className="text-zinc-500">{field.label}</dt>
                                <dd className="text-right font-medium text-zinc-950">{formatValue(row.merged_payload[field.key])}</dd>
                              </div>
                            )) : <p className="text-zinc-500">No direct correction fields mapped for this row.</p>}
                          </dl>
                        </div>

                        <div className="rounded-2xl border border-black/8 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Issue detail</p>
                          <div className="mt-3 space-y-2 text-sm text-zinc-600">
                            {row.validation_errors.map((issue, index) => (
                              <div key={`${row.id}-detail-${index}`} className="rounded-2xl border border-black/6 bg-[#faf8f5] p-3">
                                <p className="font-medium text-zinc-950">{issue.message || issue.code}</p>
                                {issue.field ? <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">Field: {issue.field}</p> : null}
                                {issue.metadata?.remainingRehab ? (
                                  <p className="mt-2 text-xs text-zinc-500">Remaining rehab: {formatCurrencyCompact(Number(issue.metadata.remainingRehab))}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-black/8 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Correction history</p>
                          <div className="mt-3 space-y-2 text-sm text-zinc-600">
                            {row.correction_history.length === 0 ? (
                              <p>No corrections applied yet.</p>
                            ) : (
                              row.correction_history.slice().reverse().map((entry, index) => (
                                <div key={`${row.id}-history-${index}`} className="rounded-2xl border border-black/6 bg-[#faf8f5] p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium capitalize text-zinc-950">{entry.action || "updated"}</p>
                                    <p className="text-xs text-zinc-500">{entry.appliedAt ? new Date(entry.appliedAt).toLocaleString() : ""}</p>
                                  </div>
                                  {entry.fields?.length ? <p className="mt-1 text-xs text-zinc-500">Fields: {entry.fields.join(", ")}</p> : null}
                                  {entry.note ? <p className="mt-2 text-sm text-zinc-600">{entry.note}</p> : null}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-black/8 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Relational audit trail</p>
                          <div className="mt-3 space-y-2 text-sm text-zinc-600">
                            {row.remediation_audits.length === 0 ? (
                              <p>No relational audit entries yet.</p>
                            ) : (
                              row.remediation_audits.slice(0, 4).map((entry) => (
                                <div key={entry.id} className="rounded-2xl border border-black/6 bg-[#faf8f5] p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium capitalize text-zinc-950">{formatAuditLabel(entry.action_type)}</p>
                                    <p className="text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString()}</p>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                                    <span>{entry.field_name || "event"}</span>
                                    <span className="text-zinc-300">/</span>
                                    <span>{formatAuditLabel(entry.entity_type)}</span>
                                  </div>
                                  <p className="mt-2 text-sm text-zinc-600">{formatValue(entry.old_value)} → {formatValue(entry.new_value)}</p>
                                  {entry.note ? <p className="mt-2 text-sm text-zinc-600">{entry.note}</p> : null}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default function StrongboxImportReviewPage() {
  return (
    <Suspense fallback={<div className="rounded-[24px] border border-black/10 bg-white p-8 text-sm text-zinc-500">Loading remediation queue...</div>}>
      <StrongboxImportReviewContent />
    </Suspense>
  );
}
