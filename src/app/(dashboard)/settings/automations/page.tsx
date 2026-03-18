"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Clock,
  Play,
  Loader2,
  CheckCircle2,
  Bell,
  CreditCard,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const JOB_ICONS: Record<string, typeof Clock> = {
  maturity_reminders: Bell,
  payment_reminders: CreditCard,
  document_expiration: FileText,
  delinquency_alerts: AlertTriangle,
};

export default function AutomationsPage() {
  const [lastResults, setLastResults] = useState<Record<string, any>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["scheduled-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/scheduled-jobs");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const runJob = useMutation({
    mutationFn: async (jobType: string) => {
      const res = await fetch("/api/scheduled-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data, jobType) => {
      setLastResults((prev) => ({ ...prev, [jobType]: data.results }));
    },
  });

  const jobs = data?.jobs || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Scheduled Automations</h1>
          <p className="text-sm text-stone-500 mt-1">
            Configure and run automated jobs for reminders and alerts
          </p>
        </div>
        <button
          onClick={() => runJob.mutate("all")}
          disabled={runJob.isPending}
          className="flex items-center gap-2 rounded-md bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#162D4A] disabled:opacity-50"
        >
          {runJob.isPending && runJob.variables === "all" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Run All Jobs
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job: any) => {
            const Icon = JOB_ICONS[job.id] || Clock;
            const result = lastResults[job.id];
            const isRunning = runJob.isPending && (runJob.variables === job.id || runJob.variables === "all");

            return (
              <div
                key={job.id}
                className="rounded-lg border bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-[#EFF4F9] p-3">
                      <Icon className="h-5 w-5 text-[#1E3A5F]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{job.name}</h3>
                      <p className="text-xs text-stone-500 mt-0.5">{job.description}</p>
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-stone-400">
                        <Clock className="h-3 w-3" />
                        {job.schedule}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => runJob.mutate(job.id)}
                    disabled={isRunning}
                    className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    {isRunning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Run Now
                  </button>
                </div>

                {result && (
                  <div className="mt-3 rounded-md bg-emerald-50 p-3">
                    <div className="flex items-center gap-2 text-xs text-emerald-700400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="font-medium">Job completed</span>
                    </div>
                    <pre className="text-[10px] text-stone-500 mt-1 font-mono">
                      {JSON.stringify(result[job.id] || result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
