import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (request, ctx) => {
  const orgId = ctx.organizationId;

  const [
    loansByStatus,
    totalLoans,
    totalContacts,
    recentLoans,
    recentActivity,
  ] = await Promise.all([
    // Loans grouped by status
    prisma.loan.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: true,
      _sum: { loanAmount: true },
    }),
    // Total loan count
    prisma.loan.count({ where: { organizationId: orgId } }),
    // Total contacts
    prisma.contact.count({ where: { organizationId: orgId, isActive: true } }),
    // Recent loans
    prisma.loan.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        borrower: { select: { firstName: true, lastName: true } },
        property: { select: { address: true, city: true, state: true } },
      },
    }),
    // Recent audit activity
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  // Compute aggregates
  const pipelineStatuses = [
    "LEAD", "APPLICATION", "PROCESSING", "UNDERWRITING",
    "CONDITIONAL_APPROVAL", "APPROVED", "CLOSING",
  ];
  const activeStatuses = ["ACTIVE", "EXTENDED", "FUNDED"];

  const pipeline = loansByStatus
    .filter((s) => pipelineStatuses.includes(s.status))
    .reduce(
      (acc, s) => ({
        count: acc.count + s._count,
        amount: acc.amount + Number(s._sum.loanAmount || 0),
      }),
      { count: 0, amount: 0 }
    );

  const activePortfolio = loansByStatus
    .filter((s) => activeStatuses.includes(s.status))
    .reduce(
      (acc, s) => ({
        count: acc.count + s._count,
        amount: acc.amount + Number(s._sum.loanAmount || 0),
      }),
      { count: 0, amount: 0 }
    );

  const paidOff = loansByStatus.find((s) => s.status === "PAID_OFF");
  const defaulted = loansByStatus.filter((s) =>
    ["DEFAULT", "FORECLOSURE", "REO"].includes(s.status)
  );

  return NextResponse.json({
    pipeline,
    activePortfolio,
    paidOff: {
      count: paidOff?._count || 0,
      amount: Number(paidOff?._sum.loanAmount || 0),
    },
    distressed: defaulted.reduce(
      (acc, s) => ({
        count: acc.count + s._count,
        amount: acc.amount + Number(s._sum.loanAmount || 0),
      }),
      { count: 0, amount: 0 }
    ),
    totalLoans,
    totalContacts,
    loansByStatus: loansByStatus.map((s) => ({
      status: s.status,
      count: s._count,
      amount: Number(s._sum.loanAmount || 0),
    })),
    recentLoans,
    recentActivity,
  });
}, "view_all_loans");
