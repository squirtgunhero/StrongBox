"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Trash2,
  FileText,
  Image,
  Loader2,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatRelative } from "@/lib/utils/dates";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function DocumentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      router.push("/documents");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const doc = data?.document;
  if (!doc) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-zinc-500">Document not found</p>
      </div>
    );
  }

  const isImage = doc.fileType?.startsWith("image/");
  const isPdf = doc.fileType?.includes("pdf");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/documents"
          className="rounded-md p-2 text-zinc-500 hover:text-zinc-400 hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{doc.fileName}</h1>
          <p className="text-sm text-zinc-500">{doc.category.replace(/_/g, " ")}</p>
        </div>
        <div className="flex items-center gap-2">
          {doc.storageUrl && (
            <a
              href={doc.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-white/5"
            >
              <Download className="h-4 w-4" /> Download
            </a>
          )}
          <button
            onClick={() => {
              if (confirm("Delete this document permanently?")) {
                deleteMutation.mutate();
              }
            }}
            className="flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50900950"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Preview */}
        <div className="col-span-2">
          <div className="rounded-lg border bg-white overflow-hidden">
            {doc.storageUrl ? (
              isImage ? (
                <img
                  src={doc.storageUrl}
                  alt={doc.fileName}
                  className="w-full max-h-[600px] object-contain bg-white/10"
                />
              ) : isPdf ? (
                <iframe
                  src={doc.storageUrl}
                  className="w-full h-[600px]"
                  title={doc.fileName}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-20 text-center">
                  <FileText className="h-16 w-16 text-zinc-600 mb-4" />
                  <p className="text-sm text-zinc-500 mb-3">
                    Preview not available for this file type
                  </p>
                  <a
                    href={doc.storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#3B82F6] hover:text-blue-400"
                  >
                    <ExternalLink className="h-4 w-4" /> Open in new tab
                  </a>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center p-20 text-center">
                <Clock className="h-16 w-16 text-zinc-600 mb-4" />
                <p className="text-sm text-zinc-500">
                  This document has been requested but not yet uploaded
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Details Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-zinc-500 text-xs">File Name</dt>
                <dd className="font-medium">{doc.fileName}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 text-xs">Category</dt>
                <dd>{doc.category.replace(/_/g, " ")}</dd>
              </div>
              {doc.subcategory && (
                <div>
                  <dt className="text-zinc-500 text-xs">Subcategory</dt>
                  <dd>{doc.subcategory}</dd>
                </div>
              )}
              <div>
                <dt className="text-zinc-500 text-xs">File Type</dt>
                <dd>{doc.fileType}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 text-xs">File Size</dt>
                <dd>{formatFileSize(doc.fileSize)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 text-xs">Version</dt>
                <dd>v{doc.version}</dd>
              </div>
              {doc.description && (
                <div>
                  <dt className="text-zinc-500 text-xs">Description</dt>
                  <dd>{doc.description}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {doc.isReceived ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-600">Received</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600">Pending</span>
                  </>
                )}
              </div>
              {doc.requestedAt && (
                <p className="text-xs text-zinc-500">
                  Requested {formatRelative(doc.requestedAt)}
                </p>
              )}
              {doc.receivedAt && (
                <p className="text-xs text-zinc-500">
                  Received {formatRelative(doc.receivedAt)}
                </p>
              )}
            </div>
          </div>

          {/* Association */}
          <div className="rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Linked To</h3>
            <div className="space-y-2 text-sm">
              {doc.loan && (
                <Link
                  href={`/loans/${doc.loan.id}`}
                  className="flex items-center gap-2 text-[#3B82F6] hover:text-blue-400"
                >
                  <FileText className="h-4 w-4" />
                  Loan {doc.loan.loanNumber}
                </Link>
              )}
              {doc.contact && (
                <Link
                  href={`/contacts/${doc.contact.id}`}
                  className="flex items-center gap-2 text-[#3B82F6] hover:text-blue-400"
                >
                  {doc.contact.firstName} {doc.contact.lastName}
                </Link>
              )}
              {doc.property && (
                <p className="text-zinc-500">
                  {doc.property.address}, {doc.property.city} {doc.property.state}
                </p>
              )}
              {!doc.loan && !doc.contact && !doc.property && (
                <p className="text-zinc-500">No association</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
