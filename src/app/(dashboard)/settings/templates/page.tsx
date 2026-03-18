"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquare, Loader2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function TemplatesPage() {
  const [viewTemplate, setViewTemplate] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["templates", typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/communications/templates?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const templates = data?.templates || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Communication Templates</h1>
        <p className="text-sm text-stone-500 mt-1">
          Pre-built email and SMS templates with merge fields
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {[
          { value: "", label: "All" },
          { value: "EMAIL", label: "Email" },
          { value: "SMS", label: "SMS" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              typeFilter === f.value
                ? "bg-[#EFF4F9] text-[#162D4A]"
                : "text-stone-500 hover:bg-stone-100"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {templates.map((tmpl: any) => (
            <div
              key={tmpl.id}
              className="rounded-lg border bg-white p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {tmpl.type === "EMAIL" ? (
                    <Mail className="h-4 w-4 text-[#1E3A5F]" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-green-500" />
                  )}
                  <h3 className="text-sm font-semibold">{tmpl.name}</h3>
                </div>
                <span className="text-[10px] font-medium text-stone-400 uppercase">
                  {tmpl.type}
                </span>
              </div>

              {tmpl.subject && (
                <p className="text-xs text-stone-500 mb-2">
                  Subject: {tmpl.subject}
                </p>
              )}

              <p className="text-xs text-stone-500 line-clamp-3 mb-3">
                {tmpl.body.replace(/<[^>]*>/g, "").substring(0, 200)}...
              </p>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {tmpl.variables.map((v: string) => (
                    <span
                      key={v}
                      className="text-[10px] font-mono bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setViewTemplate(tmpl)}
                  className="text-xs text-[#1E3A5F] hover:text-[#162D4A] font-medium flex items-center gap-1"
                >
                  <Eye className="h-3 w-3" /> Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {viewTemplate && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setViewTemplate(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-[600px] bg-white border-l shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{viewTemplate.name}</h2>
              <button
                onClick={() => setViewTemplate(null)}
                className="text-stone-400 hover:text-stone-600 text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              {viewTemplate.subject && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-stone-500 mb-1">Subject</p>
                  <p className="text-sm bg-stone-50 p-3 rounded-md font-mono">
                    {viewTemplate.subject}
                  </p>
                </div>
              )}
              <div className="mb-4">
                <p className="text-xs font-medium text-stone-500 mb-1">Body Preview</p>
                <div
                  className="text-sm bg-stone-50 p-4 rounded-md prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: viewTemplate.body }}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-stone-500 mb-1">Source</p>
                <pre className="text-xs bg-stone-50 p-4 rounded-md overflow-x-auto font-mono text-stone-600">
                  {viewTemplate.body}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
