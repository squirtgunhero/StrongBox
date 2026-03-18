"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  Image,
  Loader2,
  CheckCircle2,
  Clock,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";

function getFileIcon(fileType: string) {
  if (fileType?.startsWith("image/")) return Image;
  if (fileType?.includes("pdf")) return FileText;
  return File;
}

export default function PortalDocumentsPage() {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["portal"],
    queryFn: async () => {
      const res = await fetch("/api/portal?view=borrower");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const loans = data?.loans || [];
  const allDocs = loans.flatMap((l: any) =>
    (l.documents || []).map((d: any) => ({
      ...d,
      loanNumber: l.loanNumber,
      loanId: l.id,
    }))
  );

  const requiredPending = allDocs.filter(
    (d: any) => d.isRequired && !d.isReceived
  );

  const handleUpload = async (
    files: FileList,
    loanId: string,
    category: string
  ) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("loanId", loanId);
        formData.append("category", category);
        await fetch("/api/documents", { method: "POST", body: formData });
      }
      queryClient.invalidateQueries({ queryKey: ["portal"] });
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">My Documents</h1>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Required Documents */}
          {requiredPending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-600">
                <Clock className="h-4 w-4" />
                Requested Documents ({requiredPending.length})
              </h2>
              <div className="space-y-3">
                {requiredPending.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-4/20900"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{doc.fileName}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {doc.category.replace(/_/g, " ")} — Loan{" "}
                          {doc.loanNumber}
                        </p>
                      </div>
                      <div>
                        <input
                          type="file"
                          className="hidden"
                          id={`upload-${doc.id}`}
                          onChange={(e) => {
                            if (e.target.files) {
                              handleUpload(
                                e.target.files,
                                doc.loanId,
                                doc.category
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`upload-${doc.id}`}
                          className={cn(
                            "flex items-center gap-2 rounded-md bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white cursor-pointer hover:bg-blue-600",
                            uploading && "opacity-50 pointer-events-none"
                          )}
                        >
                          {uploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          Upload
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Documents */}
          <div>
            <h2 className="text-sm font-semibold mb-3">All Documents</h2>
            {allDocs.length === 0 ? (
              <div className="rounded-xl p-12 text-center">
                <FileText className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No documents yet</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-white/5">
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">
                        File
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">
                        Category
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
                    {allDocs.map((doc: any) => {
                      const Icon = getFileIcon(doc.fileType);
                      return (
                        <tr
                          key={doc.id}
                          className="border-b last:border-0"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-zinc-500" />
                              <span className="font-medium">
                                {doc.fileName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {doc.category.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-xs">
                            {doc.loanNumber}
                          </td>
                          <td className="px-4 py-3">
                            {doc.isReceived ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                                Received
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600">
                                <Clock className="h-3.5 w-3.5" /> Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
