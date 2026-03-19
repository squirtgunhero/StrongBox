"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Plus, RefreshCcw, Send, ShieldAlert, Upload, X } from "lucide-react";

const SHEET_FAMILIES = [
  "open_applications",
  "upcoming_loans",
  "cash_out",
  "exposure",
  "draw_requests",
  "client_list",
  "closed_projects",
  "markets",
  "cash_accounts",
  "portfolio_snapshots",
  "tax_1098_prep",
] as const;

type SheetFamily = (typeof SHEET_FAMILIES)[number];

type UploadEntry = {
  id: string;
  family: SheetFamily;
  sourceSheetName: string;
  file: File | null;
};

type BatchRow = {
  id: string;
  source_sheet_family: string;
  source_sheet_name: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  created_at: string;
  rowCounts: {
    valid: number;
    invalid: number;
    needsReview: number;
    corrected: number;
    published: number;
  };
};

type BatchesResponse = {
  batches: BatchRow[];
  total: number;
  page: number;
  limit: number;
};

type ImportResult = {
  entryId: string;
  family: string;
  sourceSheetName: string;
  dryRun: boolean;
  batchId: string | null;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    needsReview: number;
  };
  error?: string;
};

function badgeTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "published") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "validated") return "border-blue-200 bg-blue-50 text-blue-700";
  if (normalized === "failed") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function createUploadEntry(family: SheetFamily = "cash_accounts"): UploadEntry {
  return {
    id: crypto.randomUUID(),
    family,
    sourceSheetName: family,
    file: null,
  };
}

function buildQuery(params: Record<string, string | number>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (String(value).trim() !== "") searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

export default function StrongboxImportPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"sheet" | "workbook">("sheet");
  const [dryRun, setDryRun] = useState(true);
  const [entries, setEntries] = useState<UploadEntry[]>([createUploadEntry()]);
  const [results, setResults] = useState<ImportResult[]>([]);

  const batchesQuery = useQuery<BatchesResponse>({
    queryKey: ["strongbox-import-batches"],
    queryFn: async () => {
      const res = await fetch(`/api/import/strongbox?${buildQuery({ page: 1, limit: 12 })}`);
      if (!res.ok) throw new Error("Failed to load import batches");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const targets = mode === "sheet" ? entries.slice(0, 1) : entries.filter((entry) => entry.file);
      const nextResults: ImportResult[] = [];

      for (const entry of targets) {
        if (!entry.file) {
          nextResults.push({
            entryId: entry.id,
            family: entry.family,
            sourceSheetName: entry.sourceSheetName,
            dryRun,
            batchId: null,
            summary: { total: 0, valid: 0, invalid: 0, needsReview: 0 },
            error: "File is required",
          });
          continue;
        }

        const formData = new FormData();
        formData.append("file", entry.file);
        formData.append("sheetFamily", entry.family);
        formData.append("sourceSheetName", entry.sourceSheetName || entry.family);
        formData.append("dryRun", String(dryRun));

        const res = await fetch("/api/import/strongbox", { method: "POST", body: formData });
        const data = await res.json();

        nextResults.push({
          entryId: entry.id,
          family: entry.family,
          sourceSheetName: entry.sourceSheetName,
          dryRun,
          batchId: data.batchId || null,
          summary: data.summary || { total: 0, valid: 0, invalid: 0, needsReview: 0 },
          error: res.ok ? undefined : data.error || "Import failed",
        });
      }

      return nextResults;
    },
    onSuccess: (nextResults) => {
      setResults(nextResults);
      queryClient.invalidateQueries({ queryKey: ["strongbox-import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["strongbox-import-review"] });
    },
  });

  const updateEntry = (entryId: string, updater: (entry: UploadEntry) => UploadEntry) => {
    setEntries((current) => current.map((entry) => (entry.id === entryId ? updater(entry) : entry)));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-black/10 bg-[radial-gradient(circle_at_top_left,_rgba(195,55,50,0.12),_transparent_34%),linear-gradient(180deg,#ffffff_0%,#fbf7f3_100%)] p-6 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#C33732]">StrongBox Import</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Workbook and sheet-family upload</h1>
            <p className="max-w-3xl text-sm leading-6 text-zinc-600">
              Dedicated StrongBox upload flow for operational workbook families, with immediate validation results and recent batch status tied back to remediation.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/90 p-2 text-sm">
            <button type="button" onClick={() => { setMode("sheet"); setEntries((current) => [current[0] || createUploadEntry()]); }} className={`rounded-xl px-3 py-2 ${mode === "sheet" ? "bg-zinc-950 text-white" : "text-zinc-600"}`}>Single sheet</button>
            <button type="button" onClick={() => setMode("workbook")} className={`rounded-xl px-3 py-2 ${mode === "workbook" ? "bg-zinc-950 text-white" : "text-zinc-600"}`}>Workbook bundle</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#C33732]" />
            <h2 className="text-lg font-semibold text-zinc-950">Supported StrongBox families</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {SHEET_FAMILIES.map((family) => (
              <span key={family} className="rounded-full border border-black/10 bg-[#faf8f5] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-600">
                {family.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#C33732]" />
            <h2 className="text-lg font-semibold text-zinc-950">Import controls</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm text-zinc-600">
            <p>Source lineage is preserved through <span className="font-medium text-zinc-950">source_sheet</span> and <span className="font-medium text-zinc-950">source_row_key</span>.</p>
            <p>Dates, currency values, enums, and address fields are validated before publish.</p>
            <p>Invalid or review-flagged rows are routed into remediation instead of being dropped silently.</p>
          </div>
        </article>
      </section>

      <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Upload Queue</p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-950">{mode === "sheet" ? "Single family upload" : "Workbook family bundle"}</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} className="rounded" />
            Dry run only
          </label>
        </div>

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <article key={entry.id} className="rounded-[22px] border border-black/10 bg-[#fcfbfa] p-4">
              <div className="grid gap-3 xl:grid-cols-[0.9fr_1fr_1.2fr_auto]">
                <select
                  value={entry.family}
                  onChange={(event) => updateEntry(entry.id, (current) => ({ ...current, family: event.target.value as SheetFamily, sourceSheetName: current.sourceSheetName || event.target.value }))}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                >
                  {SHEET_FAMILIES.map((family) => (
                    <option key={family} value={family}>{family}</option>
                  ))}
                </select>
                <input
                  value={entry.sourceSheetName}
                  onChange={(event) => updateEntry(entry.id, (current) => ({ ...current, sourceSheetName: event.target.value }))}
                  placeholder="Source sheet name"
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                />
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-black/15 bg-white px-4 py-3 text-sm text-zinc-600">
                  <FileSpreadsheet className="h-4 w-4 text-[#C33732]" />
                  <span className="truncate">{entry.file?.name || "Select CSV or JSON file"}</span>
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    className="hidden"
                    onChange={(event) => updateEntry(entry.id, (current) => ({ ...current, file: event.target.files?.[0] || null }))}
                  />
                </label>
                {mode === "workbook" ? (
                  <button type="button" onClick={() => setEntries((current) => current.filter((candidate) => candidate.id !== entry.id))} className="rounded-2xl border border-black/10 px-3 py-3 text-sm text-zinc-600">
                    <X className="h-4 w-4" />
                  </button>
                ) : <div />}
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-zinc-500">Row {index + 1}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-[#faf8f5] px-4 py-3 text-sm text-zinc-600">
          {mode === "sheet"
            ? "Single-sheet mode sends one selected family through the existing StrongBox validator and remediation pipeline."
            : "Workbook-bundle mode lets you stage multiple family files together while preserving each source sheet name independently."}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {mode === "workbook" ? (
            <button type="button" onClick={() => setEntries((current) => [...current, createUploadEntry()])} className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-4 py-2.5 text-sm font-medium text-zinc-900">
              <Plus className="h-4 w-4" /> Add family file
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> {dryRun ? "Validate upload" : "Upload and create batch"}
          </button>
        </div>
      </section>

      {results.length > 0 ? (
        <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#C33732]" />
            <h2 className="text-xl font-semibold text-zinc-950">Latest upload results</h2>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {results.map((result) => (
              <article key={result.entryId} className="rounded-2xl border border-black/8 bg-[#faf8f5] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{result.family}</p>
                    <h3 className="mt-1 text-lg font-semibold text-zinc-950">{result.sourceSheetName}</h3>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${result.error ? "bg-red-50 text-red-700" : result.dryRun ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {result.error ? "Error" : result.dryRun ? "Validated" : "Imported"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
                  <div><p className="text-zinc-500">Rows</p><p className="font-semibold text-zinc-950">{result.summary.total}</p></div>
                  <div><p className="text-zinc-500">Valid</p><p className="font-semibold text-zinc-950">{result.summary.valid}</p></div>
                  <div><p className="text-zinc-500">Invalid</p><p className="font-semibold text-zinc-950">{result.summary.invalid}</p></div>
                  <div><p className="text-zinc-500">Review</p><p className="font-semibold text-zinc-950">{result.summary.needsReview}</p></div>
                </div>
                {result.error ? <p className="mt-4 text-sm text-red-600">{result.error}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.batchId ? (
                    <Link href={`/strongbox/review?batchId=${result.batchId}`} className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium text-zinc-900">
                      Remediation <Send className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-[0_24px_40px_-36px_rgba(15,23,42,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Batch Activity</p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Recent StrongBox import batches</h2>
          </div>
          <button type="button" onClick={() => batchesQuery.refetch()} className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 text-sm font-medium text-zinc-900">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-[#faf8f5] text-left text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-3 py-3">Family</th>
                <th className="px-3 py-3">Sheet</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Rows</th>
                <th className="px-3 py-3">Errors</th>
                <th className="px-3 py-3">Review</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {(batchesQuery.data?.batches || []).map((batch) => (
                <tr key={batch.id} className="border-b border-black/6 last:border-0">
                  <td className="px-3 py-3 font-medium text-zinc-950">{batch.source_sheet_family}</td>
                  <td className="px-3 py-3 text-zinc-600">{batch.source_sheet_name}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${badgeTone(batch.status)}`}>
                      {batch.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-zinc-600">{batch.total_rows}</td>
                  <td className="px-3 py-3 text-zinc-600">{batch.rowCounts.invalid}</td>
                  <td className="px-3 py-3 text-zinc-600">{batch.rowCounts.needsReview + batch.rowCounts.corrected}</td>
                  <td className="px-3 py-3 text-zinc-600">{new Date(batch.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-3">
                    <Link href={`/strongbox/review?batchId=${batch.id}`} className="text-[#C33732] hover:text-[#A52F2B]">Open remediation</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}