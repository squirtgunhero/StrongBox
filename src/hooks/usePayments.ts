"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function usePayments(loanId?: string) {
  return useQuery({
    queryKey: ["payments", loanId],
    queryFn: async () => {
      const params = loanId ? `?loanId=${loanId}` : "";
      const res = await fetch(`/api/payments${params}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to record payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}
