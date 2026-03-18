"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useDocuments(loanId?: string) {
  return useQuery({
    queryKey: ["documents", loanId],
    queryFn: async () => {
      const params = loanId ? `?loanId=${loanId}` : "";
      const res = await fetch(`/api/documents${params}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
