"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Mail,
  MessageSquare,
  PenTool,
  CreditCard,
  Landmark,
  BookOpen,
  MapPin,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  communications: Mail,
  documents: PenTool,
  payments: CreditCard,
  accounting: BookOpen,
  data: MapPin,
};

export default function IntegrationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await fetch("/api/integrations");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const testMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId }),
      });
      return res.json();
    },
  });

  const integrations = data?.integrations || [];
  const categories = [...new Set(integrations.map((i: any) => i.category as string))] as string[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Connect StrongBox with external services
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((cat: string) => {
            const Icon = CATEGORY_ICONS[cat] || Zap;
            const catIntegrations = integrations.filter(
              (i: any) => i.category === cat
            );

            return (
              <div key={cat}>
                <h3 className="text-sm font-semibold mb-3 capitalize flex items-center gap-2">
                  <Icon className="h-4 w-4 text-zinc-400" />
                  {cat}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {catIntegrations.map((integration: any) => (
                    <div
                      key={integration.id}
                      className="rounded-lg border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-semibold">{integration.name}</h4>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {integration.description}
                          </p>
                        </div>
                        {integration.configured ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                            <XCircle className="h-3 w-3" /> Not Configured
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-zinc-400 mb-3">
                        <p className="font-medium mb-1">Required Environment Variables:</p>
                        <div className="flex flex-wrap gap-1">
                          {integration.requiredEnvVars.map((v: string) => (
                            <span
                              key={v}
                              className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>

                      {integration.configured && (
                        <button
                          onClick={() => testMutation.mutate(integration.id)}
                          disabled={testMutation.isPending}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                        >
                          {testMutation.isPending && testMutation.variables === integration.id
                            ? "Testing..."
                            : "Test Connection"}
                        </button>
                      )}

                      {testMutation.data && testMutation.variables === integration.id && (
                        <p
                          className={cn(
                            "text-xs mt-2",
                            testMutation.data.success ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {testMutation.data.message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
