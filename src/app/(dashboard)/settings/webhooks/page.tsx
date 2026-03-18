"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Zap, ToggleLeft, ToggleRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton, TableSkeleton } from "@/components/shared/Skeleton";

const AVAILABLE_EVENTS = [
  "loan.created",
  "loan.status_changed",
  "loan.funded",
  "loan.paid_off",
  "payment.received",
  "payment.late",
  "document.uploaded",
  "document.signed",
  "draw.requested",
  "draw.approved",
  "contact.created",
  "task.completed",
];

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const res = await fetch("/api/webhooks");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createEndpoint = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", url, events: selectedEvents }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setShowForm(false);
      setUrl("");
      setSelectedEvents([]);
      if (data.secret) {
        alert(`Webhook secret (save this — it won't be shown again):\n\n${data.secret}`);
      }
    },
  });

  const testEndpoint = useMutation({
    mutationFn: async (endpointId: string) => {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", endpointId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const toggleEndpoint = useMutation({
    mutationFn: async (endpointId: string) => {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", endpointId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const deleteEndpoint = useMutation({
    mutationFn: async (endpointId: string) => {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", endpointId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  if (isLoading) return <TableSkeleton rows={3} cols={4} />;

  const endpoints = data?.endpoints || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks</h1>
          <p className="text-sm text-stone-500 mt-1">
            Send real-time event notifications to external systems
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A] transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Endpoint
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-white p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4">New Webhook Endpoint</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Endpoint URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks/strongbox"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Events
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {AVAILABLE_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={(e) =>
                        setSelectedEvents(
                          e.target.checked
                            ? [...selectedEvents, event]
                            : selectedEvents.filter((ev) => ev !== event)
                        )
                      }
                      className="rounded border-stone-300"
                    />
                    <span className="text-stone-500">{event}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => createEndpoint.mutate()}
                disabled={!url || !selectedEvents.length || createEndpoint.isPending}
                className="flex items-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A] disabled:opacity-50 transition-colors"
              >
                {createEndpoint.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Register Endpoint
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {endpoints.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Zap className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">No webhook endpoints configured</p>
        </div>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep: any) => (
            <div
              key={ep.id}
              className="rounded-lg border bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      ep.isActive ? "bg-green-500" : "bg-stone-300"
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium font-mono">{ep.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ep.events?.map((ev: string) => (
                        <span
                          key={ev}
                          className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testEndpoint.mutate(ep.id)}
                    disabled={testEndpoint.isPending}
                    className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
                    title="Send test ping"
                  >
                    <Send className="h-3 w-3" /> Test
                  </button>
                  <button
                    onClick={() => toggleEndpoint.mutate(ep.id)}
                    className="p-1.5 rounded-md hover:bg-stone-100"
                    title={ep.isActive ? "Disable" : "Enable"}
                  >
                    {ep.isActive ? (
                      <ToggleRight className="h-5 w-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-stone-400" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this webhook endpoint?")) {
                        deleteEndpoint.mutate(ep.id);
                      }
                    }}
                    className="p-1.5 rounded-md hover:bg-red-50 text-stone-400 hover:text-red-600950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
