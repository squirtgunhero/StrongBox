import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { SbDrawRequestStatus } from "@prisma/client";
import { calculateRemainingRehabFunds } from "@/lib/strongbox/calculations";
import { evaluateDrawApproval } from "@/lib/strongbox/draws";

function toSbDrawRequestStatus(value: string): SbDrawRequestStatus {
  switch (value.trim().toLowerCase()) {
    case "under_review":
      return SbDrawRequestStatus.UNDER_REVIEW;
    case "approved":
      return SbDrawRequestStatus.APPROVED;
    case "rejected":
      return SbDrawRequestStatus.REJECTED;
    case "funded":
      return SbDrawRequestStatus.FUNDED;
    default:
      return SbDrawRequestStatus.REQUESTED;
  }
}

export const GET = withAuth(async (request) => {
  const loanId = request.nextUrl.searchParams.get("loanId")?.trim();
  const status = request.nextUrl.searchParams.get("status")?.trim();

  const rows = await prisma.sbDrawRequest.findMany({
    where: {
      ...(loanId ? { loan_id: loanId } : {}),
      ...(status ? { status: toSbDrawRequestStatus(status) } : {}),
    },
    include: {
      loan: {
        include: {
          borrower: true,
          property: true,
        },
      },
      audit_entries: {
        orderBy: { created_at: "desc" },
      },
    },
    orderBy: [{ request_date: "desc" }, { created_at: "desc" }],
    take: 250,
  });

  return NextResponse.json({ drawRequests: rows });
}, "view_all_loans");

export const POST = withAuth(async (request) => {
  const body = (await request.json()) as {
    loanId: string;
    amountRequested: number;
    paymentMethod?: string;
    notes?: string;
  };

  if (!body.loanId || !body.amountRequested || body.amountRequested <= 0) {
    return NextResponse.json({ error: "loanId and positive amountRequested are required" }, { status: 400 });
  }

  const loan = await prisma.sbLoan.findUnique({ where: { id: body.loanId } });
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const drawAgg = await prisma.sbDrawRequest.aggregate({
    where: {
      loan_id: loan.id,
      status: { in: ["APPROVED", "FUNDED"] },
    },
    _sum: { approved_amount: true },
  });

  const approved = Number(drawAgg._sum.approved_amount || 0);
  const rehab = Number(loan.rehab_amount || 0);
  const remaining = calculateRemainingRehabFunds(rehab, approved) ?? 0;

  const exception = body.amountRequested > remaining;

  const draw = await prisma.sbDrawRequest.create({
    data: {
      loan_id: loan.id,
      property_id: loan.property_id,
      request_date: new Date(),
      amount_requested: body.amountRequested,
      payment_method: body.paymentMethod || null,
      status: "REQUESTED",
      notes: body.notes || null,
      exception_flag: exception,
    },
  });

  await prisma.sbDrawRequestAudit.create({
    data: {
      draw_request_id: draw.id,
      action_type: "requested",
      requested_amount: body.amountRequested,
      notes: exception ? "Request exceeds remaining rehab funds" : null,
    },
  });

  return NextResponse.json({ draw, exception }, { status: 201 });
}, "approve_draws");

export const PATCH = withAuth(async (request) => {
  const body = (await request.json()) as {
    drawRequestId: string;
    status: "under_review" | "approved" | "rejected" | "funded";
    approvedAmount?: number;
    adminOverrideEnabled?: boolean;
    notes?: string;
  };

  const draw = await prisma.sbDrawRequest.findUnique({
    where: { id: body.drawRequestId },
    include: {
      loan: true,
    },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw request not found" }, { status: 404 });
  }

  if (body.status === "approved" || body.status === "funded") {
    const amountApproved = Number(body.approvedAmount ?? draw.amount_requested);

    const approvedAgg = await prisma.sbDrawRequest.aggregate({
      where: {
        loan_id: draw.loan_id,
        status: { in: ["APPROVED", "FUNDED"] },
        NOT: { id: draw.id },
      },
      _sum: { approved_amount: true },
    });

    const rehab = Number(draw.loan.rehab_amount || 0);
    const approvedExisting = Number(approvedAgg._sum.approved_amount || 0);
    const remaining = calculateRemainingRehabFunds(rehab, approvedExisting) ?? 0;

    const decision = evaluateDrawApproval({
      loanStatus: String(draw.loan.loan_status).toLowerCase(),
      amountRequested: Number(draw.amount_requested),
      approvedAmount: amountApproved,
      remainingRehabFunds: remaining,
      adminOverrideEnabled: Boolean(body.adminOverrideEnabled),
    });

    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: decision.reason || "Approval rejected",
          exception: decision.exception,
          remainingRehabFunds: remaining,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.sbDrawRequest.update({
      where: { id: draw.id },
      data: {
        approved_amount: amountApproved,
        status: toSbDrawRequestStatus(body.status),
        processed_date: body.status === "funded" ? new Date() : draw.processed_date,
        admin_override: Boolean(body.adminOverrideEnabled),
        exception_flag: decision.exception,
        notes: body.notes || draw.notes,
      },
    });

    await prisma.sbDrawRequestAudit.create({
      data: {
        draw_request_id: draw.id,
        action_type: body.status,
        requested_amount: draw.amount_requested,
        approved_amount: amountApproved,
        notes: decision.exception ? "Approved with override beyond remaining rehab" : body.notes || null,
      },
    });

    return NextResponse.json({ draw: updated, decision });
  }

  const updated = await prisma.sbDrawRequest.update({
    where: { id: draw.id },
    data: {
      status: toSbDrawRequestStatus(body.status),
      notes: body.notes || draw.notes,
    },
  });

  await prisma.sbDrawRequestAudit.create({
    data: {
      draw_request_id: draw.id,
      action_type: body.status,
      requested_amount: draw.amount_requested,
      approved_amount: draw.approved_amount,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ draw: updated });
}, "approve_draws");
