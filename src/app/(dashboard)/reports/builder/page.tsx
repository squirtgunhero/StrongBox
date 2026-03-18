"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Loader2,
  Download,
  Play,
  Plus,
  X,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Filter = { field: string; operator: string; value: string };

export default function ReportBuilderPage() {
  const [entity, setEntity] = useState("loans");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("desc");

  const { data: fieldsData } = useQuery({
    queryKey: ["report-builder-fields"],
    queryFn: async () => {
      const res = await fetch("/api/reports/builder");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const runReport = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/reports/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, fields: selectedFields, filters, sortBy, sortDir }),
      });
      if (!res.ok) throw new Error("Failed to run report");
      return res.json();
    },
  });

  const entityFields = fieldsData?.entityFields?.[entity] || [];
  const reportData = runReport.data;

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const addFilter = () => {
    setFilters((prev) => [...prev, { field: entityFields[0]?.field || "", operator: "equals", value: "" }]);
  };

  const updateFilter = (index: number, update: Partial<Filter>) => {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...update } : f)));
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const exportCSV = async () => {
    const res = await fetch("/api/reports/builder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, fields: selectedFields, filters, sortBy, sortDir, format: "csv" }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entity}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Report Builder</h1>
        <p className="text-sm text-stone-500 mt-1">Create custom reports from any data</p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Configuration Panel */}
        <div className="col-span-1 space-y-4">
          {/* Entity */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-xs font-semibold text-stone-500 mb-2">Data Source</h3>
            <select
              value={entity}
              onChange={(e) => {
                setEntity(e.target.value);
                setSelectedFields([]);
                setFilters([]);
              }}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              {["loans", "contacts", "payments", "properties", "documents"].map((e) => (
                <option key={e} value={e}>
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Fields */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-xs font-semibold text-stone-500 mb-2">Fields ({selectedFields.length})</h3>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {entityFields.map((f: any) => (
                <label key={f.field} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-stone-50 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f.field)}
                    onChange={() => toggleField(f.field)}
                    className="rounded"
                  />
                  {f.label}
                  <span className="text-stone-400 text-[10px] ml-auto">{f.type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-stone-500">Filters</h3>
              <button onClick={addFilter} className="text-[#1E3A5F] hover:text-[#162D4A]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {filters.map((filter, i) => (
                <div key={i} className="flex items-center gap-1">
                  <select
                    value={filter.field}
                    onChange={(e) => updateFilter(i, { field: e.target.value })}
                    className="flex-1 rounded border text-[10px] px-1 py-1"
                  >
                    {entityFields.map((f: any) => (
                      <option key={f.field} value={f.field}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(i, { operator: e.target.value })}
                    className="w-16 rounded border text-[10px] px-1 py-1"
                  >
                    {["equals", "contains", "gt", "gte", "lt", "lte", "in", "dateAfter", "dateBefore"].map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <input
                    value={filter.value}
                    onChange={(e) => updateFilter(i, { value: e.target.value })}
                    className="w-20 rounded border text-[10px] px-1 py-1"
                    placeholder="value"
                  />
                  <button onClick={() => removeFilter(i)} className="text-stone-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-xs font-semibold text-stone-500 mb-2">Sort By</h3>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 rounded border text-xs px-2 py-1.5800700"
              >
                <option value="">None</option>
                {entityFields.map((f: any) => (
                  <option key={f.field} value={f.field}>{f.label}</option>
                ))}
              </select>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value)}
                className="w-16 rounded border text-xs px-2 py-1.5800700"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          </div>

          {/* Run */}
          <div className="flex gap-2">
            <button
              onClick={() => runReport.mutate()}
              disabled={selectedFields.length === 0 || runReport.isPending}
              className="flex-1 flex items-center justify-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A] disabled:opacity-50"
            >
              {runReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run
            </button>
            {reportData && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="col-span-3">
          {runReport.isPending ? (
            <div className="flex items-center justify-center p-20">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : reportData ? (
            <div className="rounded-lg border bg-white">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <p className="text-xs text-stone-500">{reportData.total} results</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-stone-50">
                      {selectedFields.map((f) => (
                        <th key={f} className="px-3 py-2 text-left font-medium text-stone-500 text-xs whitespace-nowrap">
                          {entityFields.find((ef: any) => ef.field === f)?.label || f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((row: any, i: number) => (
                      <tr key={row.id || i} className="border-b last:border-0">
                        {selectedFields.map((f) => {
                          let val: any;
                          if (f.includes(".")) {
                            const [rel, sub] = f.split(".");
                            val = row[rel]?.[sub];
                          } else {
                            val = row[f];
                          }
                          return (
                            <td key={f} className="px-3 py-2 text-xs whitespace-nowrap">
                              {val instanceof Date || (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/))
                                ? new Date(val).toLocaleDateString()
                                : val === true
                                ? "Yes"
                                : val === false
                                ? "No"
                                : val ?? "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 text-center">
              <Database className="h-12 w-12 text-stone-200 mb-4" />
              <p className="text-sm text-stone-500">Select fields and run the report</p>
              <p className="text-xs text-stone-400 mt-1">Choose a data source, pick fields, add filters, then click Run</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
