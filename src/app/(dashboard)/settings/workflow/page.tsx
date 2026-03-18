"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  Plus,
  Loader2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TRIGGER_ENTITIES = [
  { value: "loan", label: "Loan" },
  { value: "payment", label: "Payment" },
  { value: "draw", label: "Draw" },
  { value: "document", label: "Document" },
  { value: "contact", label: "Contact" },
];

const TRIGGER_EVENTS: Record<string, { value: string; label: string }[]> = {
  loan: [
    { value: "status_change", label: "Status Changed" },
    { value: "created", label: "Created" },
    { value: "updated", label: "Updated" },
    { value: "maturity_approaching", label: "Maturity Approaching" },
  ],
  payment: [
    { value: "paid", label: "Payment Received" },
    { value: "overdue", label: "Payment Overdue" },
    { value: "nsf", label: "NSF Returned" },
  ],
  draw: [
    { value: "submitted", label: "Draw Submitted" },
    { value: "approved", label: "Draw Approved" },
    { value: "funded", label: "Draw Funded" },
  ],
  document: [
    { value: "uploaded", label: "Document Uploaded" },
    { value: "requested", label: "Document Requested" },
  ],
  contact: [
    { value: "created", label: "Contact Created" },
  ],
};

const ACTION_TYPES = [
  { value: "create_task", label: "Create Task", fields: ["title", "description", "assigneeRole", "dueDays", "priority"] },
  { value: "send_email", label: "Send Email", fields: ["to", "subject", "body"] },
  { value: "send_sms", label: "Send SMS", fields: ["to", "message"] },
  { value: "create_notification", label: "In-App Notification", fields: ["userId", "title", "message"] },
  { value: "webhook", label: "Webhook", fields: ["url"] },
];

interface RuleForm {
  name: string;
  description: string;
  triggerEntity: string;
  triggerEvent: string;
  conditions: Record<string, string>;
  actions: { type: string; config: Record<string, string> }[];
}

const EMPTY_FORM: RuleForm = {
  name: "",
  description: "",
  triggerEntity: "loan",
  triggerEvent: "status_change",
  conditions: {},
  actions: [],
};

export default function WorkflowSettingsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<RuleForm>({ ...EMPTY_FORM });
  const [condKey, setCondKey] = useState("");
  const [condValue, setCondValue] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["workflow-rules"],
    queryFn: async () => {
      const res = await fetch("/api/workflow/rules");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createRule = useMutation({
    mutationFn: async (ruleData: RuleForm) => {
      const res = await fetch("/api/workflow/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruleData),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-rules"] });
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/workflow/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workflow/rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-rules"] }),
  });

  const rules = data?.rules || [];
  const events = TRIGGER_EVENTS[form.triggerEntity] || [];

  const addCondition = () => {
    if (!condKey || !condValue) return;
    setForm({ ...form, conditions: { ...form.conditions, [condKey]: condValue } });
    setCondKey("");
    setCondValue("");
  };

  const removeCondition = (key: string) => {
    const newConds = { ...form.conditions };
    delete newConds[key];
    setForm({ ...form, conditions: newConds });
  };

  const addAction = (type: string) => {
    setForm({ ...form, actions: [...form.actions, { type, config: {} }] });
  };

  const updateActionConfig = (idx: number, field: string, value: string) => {
    const newActions = [...form.actions];
    newActions[idx] = { ...newActions[idx], config: { ...newActions[idx].config, [field]: value } };
    setForm({ ...form, actions: newActions });
  };

  const removeAction = (idx: number) => {
    setForm({ ...form, actions: form.actions.filter((_, i) => i !== idx) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Workflow Rules</h1>
          <p className="text-sm text-zinc-500 mt-1">Automate actions based on triggers and conditions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" /> New Rule
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Create Workflow Rule</h3>
            <button onClick={() => { setShowCreate(false); setForm({ ...EMPTY_FORM }); }} className="text-zinc-500 hover:text-zinc-400">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Rule Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Notify on loan funding"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Trigger */}
          <div className="mb-4">
            <p className="text-xs font-medium text-zinc-500 mb-2">WHEN</p>
            <div className="flex items-center gap-3">
              <select
                value={form.triggerEntity}
                onChange={(e) => setForm({ ...form, triggerEntity: e.target.value, triggerEvent: TRIGGER_EVENTS[e.target.value]?.[0]?.value || "" })}
                className="rounded-md border px-3 py-2 text-sm"
              >
                {TRIGGER_ENTITIES.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
              <select
                value={form.triggerEvent}
                onChange={(e) => setForm({ ...form, triggerEvent: e.target.value })}
                className="rounded-md border px-3 py-2 text-sm"
              >
                {events.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditions */}
          <div className="mb-4">
            <p className="text-xs font-medium text-zinc-500 mb-2">IF (conditions match)</p>
            <div className="space-y-1.5 mb-2">
              {Object.entries(form.conditions).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-xs bg-white/5 rounded px-2 py-1.5">
                  <span className="font-medium">{key}</span>
                  <span className="text-zinc-500">=</span>
                  <span>{val}</span>
                  <button onClick={() => removeCondition(key)} className="ml-auto text-zinc-500 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={condKey}
                onChange={(e) => setCondKey(e.target.value)}
                placeholder="Field (e.g., status)"
                className="rounded-md border px-3 py-1.5 text-xs"
              />
              <span className="text-zinc-500 text-xs">=</span>
              <input
                type="text"
                value={condValue}
                onChange={(e) => setCondValue(e.target.value)}
                placeholder="Value (e.g., FUNDED)"
                className="rounded-md border px-3 py-1.5 text-xs"
              />
              <button
                onClick={addCondition}
                disabled={!condKey || !condValue}
                className="text-xs text-[#3B82F6] hover:text-blue-400 font-medium disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="mb-4">
            <p className="text-xs font-medium text-zinc-500 mb-2">THEN (execute actions)</p>
            <div className="space-y-3 mb-2">
              {form.actions.map((action, idx) => {
                const actionDef = ACTION_TYPES.find((a) => a.value === action.type);
                return (
                  <div key={idx} className="rounded-md border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium">{actionDef?.label || action.type}</span>
                      <button onClick={() => removeAction(idx)} className="text-zinc-500 hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(actionDef?.fields || []).map((field) => (
                        <div key={field}>
                          <label className="block text-[10px] text-zinc-500 mb-0.5">{field}</label>
                          <input
                            type="text"
                            value={action.config[field] || ""}
                            onChange={(e) => updateActionConfig(idx, field, e.target.value)}
                            placeholder={`{{${field}}}`}
                            className="w-full rounded border px-2 py-1 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {ACTION_TYPES.map((at) => (
                <button
                  key={at.value}
                  onClick={() => addAction(at.value)}
                  className="text-[10px] rounded-full border px-2.5 py-1 text-zinc-500 hover:bg-white/5"
                >
                  + {at.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => createRule.mutate(form)}
              disabled={!form.name || form.actions.length === 0 || createRule.isPending}
              className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {createRule.isPending ? "Creating..." : "Create Rule"}
            </button>
            <button
              onClick={() => { setShowCreate(false); setForm({ ...EMPTY_FORM }); }}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl p-12 text-center">
          <Zap className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No workflow rules configured</p>
          <p className="text-xs text-zinc-500 mt-1">Create rules to automate tasks, notifications, and more</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => {
            const conditions = rule.conditions as Record<string, string>;
            const actions = rule.actions as { type: string; config: Record<string, string> }[];
            const condEntries = Object.entries(conditions);

            return (
              <div
                key={rule.id}
                className={cn(
                  "rounded-xl p-4",
                  !rule.isActive && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className={cn("h-4 w-4", rule.isActive ? "text-amber-500" : "text-zinc-500")} />
                      <h3 className="text-sm font-semibold">{rule.name}</h3>
                    </div>
                    {rule.description && (
                      <p className="text-xs text-zinc-500 mt-0.5 ml-6">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRule.mutate({ id: rule.id, isActive: !rule.isActive })}
                      className="text-zinc-500 hover:text-zinc-400"
                    >
                      {rule.isActive ? (
                        <ToggleRight className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteRule.mutate(rule.id)}
                      className="text-zinc-500 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="ml-6 mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 w-10">When</span>
                    <span className="bg-blue-500/10 text-[#3B82F6] px-2 py-0.5 rounded">
                      {rule.triggerEntity}.{rule.triggerEvent}
                    </span>
                  </div>
                  {condEntries.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 w-10">If</span>
                      <div className="flex flex-wrap gap-1">
                        {condEntries.map(([k, v]) => (
                          <span key={k} className="bg-amber-50950 text-amber-600 px-2 py-0.5 rounded">
                            {k} = {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 w-10">Then</span>
                    <div className="flex flex-wrap gap-1">
                      {actions.map((a, i) => (
                        <span key={i} className="bg-emerald-50950 text-emerald-600 px-2 py-0.5 rounded">
                          {a.type.replace("_", " ")}
                        </span>
                      ))}
                    </div>
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
