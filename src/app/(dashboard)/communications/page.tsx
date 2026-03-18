"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  Send,
  Loader2,
  Search,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils/dates";

type CommType = "EMAIL" | "SMS" | "PHONE_CALL" | "IN_APP_NOTE";

const TYPE_OPTIONS: { value: CommType | ""; label: string; icon: typeof Mail }[] = [
  { value: "", label: "All", icon: Mail },
  { value: "EMAIL", label: "Email", icon: Mail },
  { value: "SMS", label: "SMS", icon: MessageSquare },
  { value: "PHONE_CALL", label: "Phone", icon: Phone },
  { value: "IN_APP_NOTE", label: "Notes", icon: StickyNote },
];

const TYPE_ICONS: Record<string, typeof Mail> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  PHONE_CALL: Phone,
  IN_APP_NOTE: StickyNote,
  SYSTEM_GENERATED: Mail,
};

export default function CommunicationsPage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["communications", typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      params.set("limit", "100");
      const res = await fetch(`/api/communications?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["comm-templates"],
    queryFn: async () => {
      const res = await fetch("/api/communications/templates");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const communications = data?.communications || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Communications</h1>
          <p className="text-sm text-zinc-500 mt-1">Email, SMS, and communication log</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Send className="h-4 w-4" /> Compose
        </button>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 mb-6">
        {TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                typeFilter === opt.value
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {opt.label}
            </button>
          );
        })}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          templates={templates?.templates || []}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: ["communications"] });
            setShowCompose(false);
          }}
        />
      )}

      {/* Communication List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : communications.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center dark:bg-zinc-900 dark:border-zinc-800">
          <Mail className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No communications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {communications.map((comm: any) => {
            const Icon = TYPE_ICONS[comm.type] || Mail;
            return (
              <div
                key={comm.id}
                className="rounded-lg border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-2">
                    <Icon className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-zinc-400 uppercase">
                        {comm.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {comm.direction === "INBOUND" ? "from" : "to"}{" "}
                        {comm.type === "EMAIL"
                          ? comm.toEmails?.[0] || comm.fromEmail
                          : comm.type === "SMS"
                          ? comm.toPhone || comm.fromPhone
                          : comm.contact
                          ? `${comm.contact.firstName} ${comm.contact.lastName}`
                          : "—"}
                      </span>
                      {comm.loan && (
                        <span className="text-xs text-brand-600 dark:text-brand-400">
                          {comm.loan.loanNumber}
                        </span>
                      )}
                      <span className="text-xs text-zinc-400 ml-auto">
                        {formatRelative(comm.createdAt)}
                      </span>
                    </div>
                    {comm.subject && (
                      <p className="text-sm font-medium mb-1">{comm.subject}</p>
                    )}
                    {comm.body && (
                      <p className="text-xs text-zinc-500 line-clamp-2">
                        {comm.body.replace(/<[^>]*>/g, "")}
                      </p>
                    )}
                    {comm.author && (
                      <p className="text-[10px] text-zinc-400 mt-1">
                        by {comm.author.firstName} {comm.author.lastName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ComposeModal({
  templates,
  onClose,
  onSent,
}: {
  templates: any[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [type, setType] = useState<CommType>("EMAIL");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { type, body };
      if (type === "EMAIL") {
        payload.toEmails = [to];
        payload.subject = subject;
      } else if (type === "SMS") {
        payload.toPhone = to;
      }
      const res = await fetch("/api/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Send failed");
      return res.json();
    },
    onSuccess: onSent,
  });

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl) {
      setType(tmpl.type as CommType);
      setSubject(tmpl.subject);
      setBody(tmpl.body);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[500px] bg-white dark:bg-zinc-900 border-l dark:border-zinc-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Compose</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl">
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Type */}
          <div className="flex gap-2">
            {(["EMAIL", "SMS", "PHONE_CALL", "IN_APP_NOTE"] as CommType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  type === t
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                {t.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {/* Template */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"
              >
                <option value="">— No template —</option>
                {templates
                  .filter((t) => t.type === type)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
            </div>
          )}

          {/* To */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              {type === "EMAIL" ? "To (email)" : type === "SMS" ? "To (phone)" : "Contact"}
            </label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={type === "EMAIL" ? "email@example.com" : type === "SMS" ? "+1..." : "Name"}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>

          {/* Subject */}
          {type === "EMAIL" && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"
              />
            </div>
          )}

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"
            />
            {selectedTemplate && (
              <p className="text-[10px] text-zinc-400 mt-1">
                Variables like {"{{borrowerName}}"} will be replaced when sent via workflow
              </p>
            )}
          </div>
        </div>

        <div className="border-t dark:border-zinc-800 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => sendMutation.mutate()}
            disabled={!to || !body || sendMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-md disabled:opacity-50"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </div>
      </div>
    </>
  );
}
