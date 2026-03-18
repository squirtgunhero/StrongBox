"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useContacts(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ["contacts", filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/contacts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ["contacts", id],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${id}`);
      if (!res.ok) throw new Error("Failed to fetch contact");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
