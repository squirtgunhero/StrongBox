"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Upload,
  Search,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Eye,
  Loader2,
  Filter,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils/dates";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "APPLICATION", label: "Application" },
  { value: "IDENTITY", label: "Identity" },
  { value: "ENTITY_DOCS", label: "Entity Docs" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "PROPERTY", label: "Property" },
  { value: "APPRAISAL", label: "Appraisal" },
  { value: "TITLE", label: "Title" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "DRAW_REQUEST", label: "Draw Request" },
  { value: "CLOSING", label: "Closing" },
  { value: "SERVICING", label: "Servicing" },
  { value: "CORRESPONDENCE", label: "Correspondence" },
  { value: "INTERNAL", label: "Internal" },
];

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.includes("pdf")) return FileText;
  if (fileType.includes("sheet") || fileType.includes("csv") || fileType.includes("excel"))
    return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [receivedFilter, setReceivedFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (category) queryParams.set("category", category);
  if (receivedFilter === "received") queryParams.set("isReceived", "true");
  if (receivedFilter === "pending") queryParams.set("isReceived", "false");
  queryParams.set("page", String(page));
  queryParams.set("limit", "30");

  const { data, isLoading } = useQuery({
    queryKey: ["documents", search, category, receivedFilter, page],
    queryFn: async () => {
      const res = await fetch(`/api/documents?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("category", category || "INTERNAL");
          await fetch("/api/documents", { method: "POST", body: formData });
        }
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(false);
      }
    },
    [category, queryClient]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  const documents = data?.documents || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Document Center</h1>
          <p className="text-sm text-zinc-500 mt-1">{total} documents</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
        />
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border-2 border-dashed p-8 mb-6 text-center transition-colors",
          dragOver
            ? "border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-950"
            : "border-zinc-200 dark:border-zinc-800"
        )}
      >
        <Upload className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">
          Drag and drop files here, or{" "}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-brand-600 hover:text-brand-700 font-medium"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-zinc-400 mt-1">PDF, Images, Spreadsheets, and more</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search documents..."
            className="w-full rounded-md border bg-white pl-10 pr-4 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-800"
          />
        </div>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-800"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <div className="flex rounded-md border dark:border-zinc-700">
          {[
            { value: "", label: "All" },
            { value: "received", label: "Received" },
            { value: "pending", label: "Pending" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setReceivedFilter(f.value);
                setPage(1);
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md border-r last:border-r-0 dark:border-zinc-700",
                receivedFilter === f.value
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center dark:bg-zinc-900 dark:border-zinc-800">
          <FileText className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No documents found</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">File</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Loan</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Size</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Uploaded</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc: any) => {
                const Icon = getFileIcon(doc.fileType);
                return (
                  <tr
                    key={doc.id}
                    className="border-b last:border-0 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-zinc-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium truncate max-w-[250px]">{doc.fileName}</p>
                          {doc.description && (
                            <p className="text-xs text-zinc-500 truncate max-w-[250px]">
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {doc.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {doc.loan ? (
                        <Link
                          href={`/loans/${doc.loan.id}`}
                          className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
                        >
                          {doc.loan.loanNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {doc.isReceived ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Received
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <Clock className="h-3.5 w-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {formatFileSize(doc.fileSize)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {formatRelative(doc.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="rounded p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm("Delete this document?")) {
                              deleteMutation.mutate(doc.id);
                            }
                          }}
                          className="rounded p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t dark:border-zinc-800">
              <p className="text-xs text-zinc-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs rounded border disabled:opacity-50 dark:border-zinc-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-xs rounded border disabled:opacity-50 dark:border-zinc-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
