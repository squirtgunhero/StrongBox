import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { sendNotification } from "@/lib/notifications/sender";
import { DrawStatus } from "@prisma/client";

// GET /api/draws/[id]
export const GET = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const draw = await prisma.draw.findFirst({
    where: { id, loan: { organizationId: ctx.organizationId } },
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          rehabBudget: true,
          borrower: { select: { firstName: true, lastName: true } },
        },
      },
      documents: true,
    },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  return NextResponse.json({ draw });
});

// PATCH /api/draws/[id] — update draw (approve, reject, fund, update inspection)
export const PATCH = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  const body = await request.json();

  const draw = await prisma.draw.findFirst({
    where: { id, loan: { organizationId: ctx.organizationId } },
    include: { loan: { select: { loanNumber: true, loanOfficerId: true, borrowerId: true } } },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  // Status transitions
  if (body.status) {
    const validTransitions: Record<string, string[]> = {
      SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
      UNDER_REVIEW: ["APPROVED", "REJECTED"],
      APPROVED: ["FUNDED", "CANCELLED"],
      REJECTED: ["SUBMITTED"],
    };

    const allowed = validTransitions[draw.status] || [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot transition draw from ${draw.status} to ${body.status}` },
        { status: 400 }
      );
    }

    updateData.status = body.status;

    switch (body.status) {
      case "UNDER_REVIEW":
        updateData.reviewedById = ctx.user.id;
        break;
      case "APPROVED":
        updateData.amountApproved = body.amountApproved || draw.amountRequested;
        updateData.approvedAt = new Date();
        updateData.reviewedAt = new Date();
        updateData.reviewedById = ctx.user.id;
        break;
      case "REJECTED":
        updateData.rejectedAt = new Date();
        updateData.rejectionReason = body.rejectionReason || null;
        updateData.reviewedAt = new Date();
        updateData.reviewedById = ctx.user.id;
        break;
      case "FUNDED":
        updateData.fundedAt = new Date();
        break;
    }

    // Notify loan officer of draw status changes
    if (draw.loan.loanOfficerId && draw.loan.loanOfficerId !== ctx.user.id) {
      const notifType =
        body.status === "APPROVED"
          ? "DRAW_APPROVED"
          : body.status === "REJECTED"
          ? "DRAW_REJECTED"
          : "DRAW_SUBMITTED";
      await sendNotification({
        userId: draw.loan.loanOfficerId,
        type: notifType as any,
        title: `Draw #${draw.drawNumber} ${body.status.toLowerCase()}`,
        message: `Draw on loan ${draw.loan.loanNumber} has been ${body.status.toLowerCase()}`,
        loanId: draw.loanId,
        actionUrl: `/loans/${draw.loanId}`,
      });
    }
  }

  // Inspection fields
  if (body.inspectionDate !== undefined) updateData.inspectionDate = body.inspectionDate ? new Date(body.inspectionDate) : null;
  if (body.inspectionNotes !== undefined) updateData.inspectionNotes = body.inspectionNotes;
  if (body.inspectorName !== undefined) updateData.inspectorName = body.inspectorName;
  if (body.inspectionPassed !== undefined) updateData.inspectionPassed = body.inspectionPassed;
  if (body.reviewNotes !== undefined) updateData.reviewNotes = body.reviewNotes;
  if (body.workCompleted !== undefined) updateData.workCompleted = body.workCompleted;
  if (body.percentComplete !== undefined) updateData.percentComplete = parseFloat(body.percentComplete);

  const updated = await prisma.draw.update({
    where: { id },
    data: updateData,
    include: {
      loan: { select: { id: true, loanNumber: true } },
      documents: { select: { id: true, fileName: true } },
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "UPDATE",
    entityType: "Draw",
    entityId: id,
    description: `Updated draw #${draw.drawNumber} on loan ${draw.loan.loanNumber}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: { status: draw.status } as any,
    after: updateData as any,
  });

  return NextResponse.json({ draw: updated });
}, "approve_draws");
