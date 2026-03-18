"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useTasks(params?: {
  view?: string;
  loanId?: string;
  status?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.view) searchParams.set("view", params.view);
  if (params?.loanId) searchParams.set("loanId", params.loanId);
  if (params?.status) searchParams.set("status", params.status);

  return useQuery({
    queryKey: ["tasks", params],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      title: string;
      description?: string;
      loanId?: string;
      assigneeId?: string;
      dueDate?: string;
      priority?: string;
    }) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
