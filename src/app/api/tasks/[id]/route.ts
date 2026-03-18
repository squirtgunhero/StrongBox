import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { sendNotification } from "@/lib/notifications/sender";
import { TaskStatus, TaskPriority } from "@prisma/client";

// GET /api/tasks/[id]
export const GET = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      loan: { select: { id: true, loanNumber: true, borrower: { select: { firstName: true, lastName: true } } } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ task });
});

// PATCH /api/tasks/[id] — update task (status, assignee, priority, etc.)
export const PATCH = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  const body = await request.json();

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  if (body.priority && Object.values(TaskPriority).includes(body.priority)) {
    updateData.priority = body.priority;
  }

  if (body.status && Object.values(TaskStatus).includes(body.status)) {
    updateData.status = body.status;
    if (body.status === "COMPLETED") {
      updateData.completedAt = new Date();
    }
  }

  if (body.assigneeId !== undefined) {
    updateData.assigneeId = body.assigneeId || null;
    // Notify new assignee
    if (body.assigneeId && body.assigneeId !== ctx.user.id && body.assigneeId !== task.assigneeId) {
      await sendNotification({
        userId: body.assigneeId,
        type: "TASK_ASSIGNED",
        title: "Task Reassigned to You",
        message: `${ctx.user.firstName} ${ctx.user.lastName} assigned you: "${task.title}"`,
        loanId: task.loanId || undefined,
        actionUrl: task.loanId ? `/loans/${task.loanId}` : "/tasks",
      });
    }
  }

  const updated = await prisma.task.update({
    where: { id },
    data: updateData,
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      loan: { select: { id: true, loanNumber: true } },
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "UPDATE",
    entityType: "Task",
    entityId: id,
    description: `Updated task: ${task.title}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: { status: task.status, assigneeId: task.assigneeId } as any,
    after: updateData as any,
  });

  return NextResponse.json({ task: updated });
});

// DELETE /api/tasks/[id]
export const DELETE = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "DELETE",
    entityType: "Task",
    entityId: id,
    description: `Deleted task: ${task.title}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: { title: task.title, status: task.status } as any,
  });

  return NextResponse.json({ success: true });
});
