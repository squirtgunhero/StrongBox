"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useLoans(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ["loans", filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/loans?${params}`);
      if (!res.ok) throw new Error("Failed to fetch loans");
      return res.json();
    },
  });
}

export function useLoan(id: string) {
  return useQuery({
    queryKey: ["loans", id],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${id}`);
      if (!res.ok) throw new Error("Failed to fetch loan");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create loan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}
