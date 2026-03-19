"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ENTITY_TYPES = ["", "Loan", "Contact", "Property", "User", "Payment", "Draw"];
const ACTIONS = ["", "CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"];

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700950400",
  UPDATE: "bg-[#C33732]/10 text-[#162D4A]",
  DELETE: "bg-red-100 text-red-400400",
  STATUS_CHANGE: "bg-amber-100 text-amber-700950400",
};

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", { entityType, action, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (action) params.set("action", action);
      params.set("page", page.toString());
      params.set("limit", "30");
      const res = await fetch(`/api/audit-log?${params}`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Track all changes made across your organization.
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="h-9 rounded-md px-3 text-sm"
        >
          <option value="">All entities</option>
          {ENTITY_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="h-9 rounded-md px-3 text-sm"
        >
          <option value="">All actions</option>
          {ACTIONS.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : !data?.logs?.length ? (
          <div className="p-12 text-center">
            <ScrollText className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="divide-y800">
              {data.logs.map((log: any) => (
                <div key={log.id}>
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === log.id ? null : log.id)
                    }
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        ACTION_COLORS[log.action] || "bg-white/10 text-zinc-700"
                      )}
                    >
                      {log.action}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium min-w-[60px]">
                      {log.entityType}
                    </span>
                    <span className="text-sm flex-1 truncate">
                      {log.description}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {log.user
                        ? `${log.user.firstName} ${log.user.lastName}`
                        : log.userEmail}
                    </span>
                    <span className="text-xs text-zinc-500 min-w-[130px] text-right">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    {log.diff ? (
                      expandedId === log.id ? (
                        <ChevronUp className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}
                  </button>

                  {expandedId === log.id && log.diff && (
                    <div className="px-4 pb-3">
                      <div className="rounded-md bg-white/5 p-3 text-xs font-mono overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-zinc-500">
                              <th className="text-left pb-1 pr-4">Field</th>
                              <th className="text-left pb-1 pr-4">Before</th>
                              <th className="text-left pb-1">After</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(log.diff as Record<string, any>).map(
                              ([field, change]: [string, any]) => (
                                <tr key={field}>
                                  <td className="pr-4 py-0.5 text-zinc-500">
                                    {field}
                                  </td>
                                  <td className="pr-4 py-0.5 text-red-600400">
                                    {JSON.stringify(change.from)}
                                  </td>
                                  <td className="py-0.5 text-green-600400">
                                    {JSON.stringify(change.to)}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-xs text-zinc-500">
                  {(page - 1) * data.limit + 1}-
                  {Math.min(page * data.limit, data.total)} of {data.total}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded p-1 hover:bg-white/5 disabled:opacity-30800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="rounded p-1 hover:bg-white/5 disabled:opacity-30800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
