import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { sendNotification } from "@/lib/notifications/sender";
import { TaskStatus, TaskPriority } from "@prisma/client";

// GET /api/tasks — list tasks with filters
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const view = searchParams.get("view"); // "my" | "team" | "loan"
  const loanId = searchParams.get("loanId");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const assigneeId = searchParams.get("assigneeId");
  const overdue = searchParams.get("overdue");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  // Task visibility is scoped through loan's organizationId or direct assignment
  if (view === "my") {
    where.assigneeId = ctx.user.id;
  } else if (view === "loan" && loanId) {
    where.loanId = loanId;
  } else {
    // Team view — all tasks for loans in this org
    where.OR = [
      { assigneeId: ctx.user.id },
      { createdById: ctx.user.id },
      { loan: { organizationId: ctx.organizationId } },
      { loan: null, createdById: ctx.user.id },
    ];
  }

  if (loanId) where.loanId = loanId;
  if (status && Object.values(TaskStatus).includes(status as TaskStatus)) {
    where.status = status;
  }
  if (priority && Object.values(TaskPriority).includes(priority as TaskPriority)) {
    where.priority = priority;
  }
  if (assigneeId) where.assigneeId = assigneeId;
  if (overdue === "true") {
    where.dueDate = { lt: new Date() };
    where.status = { in: ["PENDING", "IN_PROGRESS"] };
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where: where as any,
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        loan: { select: { id: true, loanNumber: true } },
      },
    }),
    prisma.task.count({ where: where as any }),
  ]);

  // Compute overdue count for the badge
  const overdueCount = await prisma.task.count({
    where: {
      assigneeId: ctx.user.id,
      dueDate: { lt: new Date() },
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
  });

  return NextResponse.json({
    tasks,
    total,
    overdueCount,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// POST /api/tasks — create a task
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { title, description, loanId, assigneeId, dueDate, priority, status } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Validate loan belongs to org
  if (loanId) {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, organizationId: ctx.organizationId },
    });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description || null,
      loanId: loanId || null,
      assigneeId: assigneeId || null,
      createdById: ctx.user.id,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority && Object.values(TaskPriority).includes(priority) ? priority : "MEDIUM",
      status: status && Object.values(TaskStatus).includes(status) ? status : "PENDING",
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      loan: { select: { id: true, loanNumber: true } },
    },
  });

  // Notify assignee
  if (assigneeId && assigneeId !== ctx.user.id) {
    await sendNotification({
      userId: assigneeId,
      type: "TASK_ASSIGNED",
      title: "New Task Assigned",
      message: `${ctx.user.firstName} ${ctx.user.lastName} assigned you: "${title}"`,
      loanId: loanId || undefined,
      actionUrl: loanId ? `/loans/${loanId}` : "/tasks",
    });
  }

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "Task",
    entityId: task.id,
    description: `Created task: ${title}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    after: { title, assigneeId, loanId, priority } as any,
  });

  return NextResponse.json({ task }, { status: 201 });
});
