"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, X, Database } from "lucide-react";
import { cn } from "@/lib/utils";

type ImportType = "contacts" | "loans" | "payments" | "properties";
type MigrationSheet = "cash_out" | "exposure" | "client_list" | "tracy_stone_loan_summary" | "available_cash";

const MIGRATION_SHEETS: { value: MigrationSheet; label: string; description: string }[] = [
  { value: "cash_out", label: "Cash Out Sheet", description: "Loan payoffs and capital returns" },
  { value: "exposure", label: "Exposure Sheet", description: "Investor capital allocations per loan" },
  { value: "client_list", label: "Client List", description: "Borrower and contact records" },
  { value: "tracy_stone_loan_summary", label: "Tracy Stone Loan Summary", description: "Loan details and terms" },
  { value: "available_cash", label: "Available Cash", description: "Capital source balances" },
];

const IMPORT_TYPES: { value: ImportType; label: string; description: string; sampleHeaders: string }[] = [
  { value: "contacts", label: "Contacts", description: "Import borrowers, investors, and other contacts", sampleHeaders: "first_name, last_name, email, phone, type, is_borrower, is_investor" },
  { value: "loans", label: "Loans", description: "Import loan records with borrower matching", sampleHeaders: "loan_number, borrower, loan_amount, interest_rate, term_months, status, type" },
  { value: "payments", label: "Payments", description: "Import historical payment records", sampleHeaders: "loan_number, amount, due_date, paid_date, method" },
  { value: "properties", label: "Properties", description: "Import property records", sampleHeaders: "address, city, state, zip, property_type" },
];

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType>("contacts");
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", importType);
      formData.append("dryRun", String(dryRun));

      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setResults({ error: data.error });
      } else {
        setResults(data);
      }
    } catch {
      setResults({ error: "Import failed" });
    } finally {
      setIsImporting(false);
    }
  };

  const typeCfg = IMPORT_TYPES.find((t) => t.value === importType)!;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Data Import</h1>
        <p className="text-sm text-zinc-500 mt-1">Import data from CSV files</p>
      </div>

      {/* Import Type */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {IMPORT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setImportType(t.value); setResults(null); }}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              importType === t.value
                ? "border-[#1E3A5F] bg-[#C33732]/10 "
                : "bg-white hover:bg-white/5"
            )}
          >
            <p className="text-sm font-medium">{t.label}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{t.description}</p>
          </button>
        ))}
      </div>

      {/* Upload Area */}
      <div className="rounded-xl p-5 mb-6">
        <div className="flex items-start gap-6">
          <div
            className={cn(
              "flex-1 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              file ? "border-emerald-300 bg-emerald-50/50" : "border-white/[0.12] hover:border-[#93B4D4]"
            )}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResults(null); }}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResults(null); }}
                  className="text-zinc-500 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">Click to select a CSV file</p>
                <p className="text-[10px] text-zinc-500 mt-1">Supports .csv and .tsv formats</p>
              </>
            )}
          </div>

          <div className="w-64 space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded"
                />
                Dry Run (preview only)
              </label>
              <p className="text-[10px] text-zinc-500 mt-1 ml-6">
                Validates data without creating records
              </p>
            </div>

            <button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-[#C33732] px-4 py-2 text-sm font-medium text-white hover:bg-[#A52F2B] disabled:opacity-50"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {dryRun ? "Validate" : "Import"}
            </button>

            <div className="text-[10px] text-zinc-500">
              <p className="font-medium mb-1">Expected headers:</p>
              <p className="font-mono">{typeCfg.sampleHeaders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Migration Section */}
      <MigrationSection />

      {/* Results */}
      {results && (
        <div className="rounded-xl p-5">
          {results.error ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm font-medium">{results.error}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h3 className="text-sm font-semibold">
                  {results.dryRun ? "Validation" : "Import"} Results
                </h3>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="rounded-md bg-white/5 p-3">
                  <p className="text-xs text-zinc-500">Total Rows</p>
                  <p className="text-lg font-bold">{results.results.total}</p>
                </div>
                <div className="rounded-md bg-emerald-50950/30 p-3">
                  <p className="text-xs text-zinc-500">Valid</p>
                  <p className="text-lg font-bold text-emerald-600">{results.results.valid}</p>
                </div>
                <div className="rounded-md bg-[#C33732]/10 p-3">
                  <p className="text-xs text-zinc-500">{results.dryRun ? "Would Create" : "Created"}</p>
                  <p className="text-lg font-bold text-[#C33732]">{results.dryRun ? results.results.valid : results.results.created}</p>
                </div>
                <div className="rounded-md bg-amber-50950/30 p-3">
                  <p className="text-xs text-zinc-500">Skipped / Errors</p>
                  <p className="text-lg font-bold text-amber-600">{results.results.skipped + results.results.errors.length}</p>
                </div>
              </div>

              {results.results.errors.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Errors</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {results.results.errors.map((err: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                        <span className="font-medium">Row {err.row}</span>
                        <span className="text-zinc-500">|</span>
                        <span>{err.field}: {err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.sampleRows && results.sampleRows.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-2">Sample Data (first 3 rows)</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="border-b">
                          {results.headers.map((h: string) => (
                            <th key={h} className="px-2 py-1.5 text-left font-medium text-zinc-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.sampleRows.map((row: any, i: number) => (
                          <tr key={i} className="border-b last:border-0">
                            {results.headers.map((h: string) => (
                              <td key={h} className="px-2 py-1.5 text-zinc-500">{row[h] || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MigrationSection() {
  const [sheetType, setSheetType] = useState<MigrationSheet>("cash_out");
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [migrationResults, setMigrationResults] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleMigration = async () => {
    if (!file) return;
    setIsRunning(true);
    setMigrationResults(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sheetType", sheetType);
      formData.append("dryRun", String(dryRun));
      const res = await fetch("/api/import/migration", { method: "POST", body: formData });
      const data = await res.json();
      setMigrationResults(data);
    } catch {
      setMigrationResults({ error: "Migration failed" });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="mt-8 border-t pt-8">
      <div className="mb-4 flex items-center gap-2">
        <Database className="h-5 w-5 text-[#C33732]" />
        <h2 className="text-lg font-semibold">Data Migration</h2>
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        Import data from Strong Investor Loans specific spreadsheets
      </p>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {MIGRATION_SHEETS.map((s) => (
          <button
            key={s.value}
            onClick={() => { setSheetType(s.value); setMigrationResults(null); }}
            className={cn(
              "rounded-lg border p-2 text-left transition-colors",
              sheetType === s.value
                ? "border-[#1E3A5F] bg-[#C33732]/10 "
                : "bg-white hover:bg-white/5"
            )}
          >
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{s.description}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setMigrationResults(null); }}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className={cn(
                "w-full border-2 border-dashed rounded-lg p-4 text-center transition-colors",
                file ? "border-emerald-300 bg-emerald-50/50" : "border-white/[0.12] hover:border-[#93B4D4]"
              )}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-zinc-500 hover:text-zinc-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Click to select a CSV file</p>
              )}
            </button>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="rounded" />
              Dry Run
            </label>
            <button
              onClick={handleMigration}
              disabled={!file || isRunning}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-[#C33732] px-4 py-2 text-sm font-medium text-white hover:bg-[#A52F2B] disabled:opacity-50"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Migrate
            </button>
          </div>
        </div>
      </div>

      {migrationResults && (
        <div className="mt-4 rounded-xl p-5">
          {migrationResults.error ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm font-medium">{migrationResults.error}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h3 className="text-sm font-semibold">
                  {migrationResults.dryRun ? "Validation" : "Migration"} Results — {migrationResults.sheetType}
                </h3>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="rounded-md bg-white/5 p-3">
                  <p className="text-xs text-zinc-500">Total</p>
                  <p className="text-lg font-bold">{migrationResults.results.total}</p>
                </div>
                <div className="rounded-md bg-white/5 p-3">
                  <p className="text-xs text-zinc-500">Processed</p>
                  <p className="text-lg font-bold">{migrationResults.results.processed}</p>
                </div>
                <div className="rounded-md bg-emerald-50950/30 p-3">
                  <p className="text-xs text-zinc-500">Created</p>
                  <p className="text-lg font-bold text-emerald-600">{migrationResults.results.created}</p>
                </div>
                <div className="rounded-md bg-[#C33732]/10 p-3">
                  <p className="text-xs text-zinc-500">Updated</p>
                  <p className="text-lg font-bold text-[#C33732]">{migrationResults.results.updated}</p>
                </div>
                <div className="rounded-md bg-amber-50950/30 p-3">
                  <p className="text-xs text-zinc-500">Errors</p>
                  <p className="text-lg font-bold text-amber-600">{migrationResults.results.errors.length}</p>
                </div>
              </div>
              {migrationResults.results.errors.length > 0 && (
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {migrationResults.results.errors.map((err: any, i: number) => (
                    <div key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                      Row {err.row}: {err.message}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
