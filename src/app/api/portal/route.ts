import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils/currency";

// GET /api/portal — investor/borrower portal dashboard data
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const view = searchParams.get("view") || "investor";

  if (view === "investor") {
    return getInvestorPortal(ctx);
  }

  return getBorrowerPortal(ctx);
});

async function getInvestorPortal(ctx: { user: any; organizationId: string }) {
  // Find the contact record linked to this user (investor)
  const contact = await prisma.contact.findFirst({
    where: {
      organizationId: ctx.organizationId,
      isInvestor: true,
      // Try to match by email
      email: ctx.user.email,
    },
  });

  if (!contact) {
    // If no contact match, return all investor data for admin users
    const hasAdminAccess = ["ADMIN", "SUPER_ADMIN", "OWNER"].includes(ctx.user.role);
    if (!hasAdminAccess) {
      return NextResponse.json({ error: "No investor profile found" }, { status: 404 });
    }

    // Admin view: all investor data
    const accounts = await prisma.investorCapitalAccount.findMany({
      include: {
        contact: { select: { firstName: true, lastName: true, email: true } },
        transactions: { orderBy: { transactionDate: "desc" }, take: 20 },
      },
    });

    const sources = await prisma.capitalSource.findMany({
      where: { organizationId: ctx.organizationId, type: "PRIVATE_INVESTOR" },
      include: {
        allocations: {
          where: { isActive: true },
          include: {
            loan: {
              select: {
                loanNumber: true, status: true, loanAmount: true, interestRate: true,
                maturityDate: true, currentBalance: true,
                property: { select: { address: true, city: true, state: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      view: "admin",
      accounts,
      sources,
      summary: {
        totalInvestors: accounts.length,
        totalDeployed: accounts.reduce((s, a) => s + Number(a.totalDeployed), 0),
        totalReturned: accounts.reduce((s, a) => s + Number(a.totalReturned), 0),
        totalInterestEarned: accounts.reduce((s, a) => s + Number(a.totalInterestEarned), 0),
      },
    });
  }

  // Individual investor view
  const account = await prisma.investorCapitalAccount.findUnique({
    where: { contactId: contact.id },
    include: {
      transactions: { orderBy: { transactionDate: "desc" }, take: 50 },
    },
  });

  // Get their capital source allocations
  const capitalSources = await prisma.capitalSource.findMany({
    where: { organizationId: ctx.organizationId, contactId: contact.id },
    include: {
      allocations: {
        where: { isActive: true },
        include: {
          loan: {
            select: {
              loanNumber: true, status: true, loanAmount: true, interestRate: true,
              maturityDate: true, currentBalance: true,
              property: { select: { address: true, city: true, state: true } },
              borrower: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  const activeAllocations = capitalSources.flatMap((s) => s.allocations);

  return NextResponse.json({
    view: "investor",
    investor: {
      name: `${contact.firstName} ${contact.lastName}`,
      email: contact.email,
    },
    account: account || { currentBalance: 0, totalDeployed: 0, totalReturned: 0, totalInterestEarned: 0, activeLoanCount: 0 },
    portfolio: activeAllocations.map((a) => ({
      loanNumber: a.loan.loanNumber,
      borrower: `${a.loan.borrower.lastName}, ${a.loan.borrower.firstName}`,
      property: a.loan.property ? `${a.loan.property.address}, ${a.loan.property.city}` : "—",
      amount: Number(a.amount),
      loanAmount: Number(a.loan.loanAmount),
      interestRate: Number(a.loan.interestRate),
      status: a.loan.status,
      maturityDate: a.loan.maturityDate,
    })),
    transactions: (account?.transactions || []).map((t) => ({
      id: t.id,
      date: t.transactionDate,
      amount: Number(t.amount),
      type: t.type,
      description: t.description,
      referenceNumber: t.referenceNumber,
    })),
    capitalSources: capitalSources.map((s) => ({
      name: s.name,
      creditLimit: Number(s.creditLimit || 0),
      deployed: Number(s.totalDeployed || 0),
      available: Number(s.creditLimit || 0) - Number(s.totalDeployed || 0),
    })),
  });
}

async function getBorrowerPortal(ctx: { user: any; organizationId: string }) {
  const contact = await prisma.contact.findFirst({
    where: { organizationId: ctx.organizationId, email: ctx.user.email },
  });

  if (!contact) {
    return NextResponse.json({ error: "No borrower profile found" }, { status: 404 });
  }

  const loans = await prisma.loan.findMany({
    where: { organizationId: ctx.organizationId, borrowerId: contact.id },
    include: {
      property: { select: { address: true, city: true, state: true } },
      payments: {
        where: { status: { in: ["SCHEDULED", "PENDING"] } },
        orderBy: { dueDate: "asc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    view: "borrower",
    borrower: {
      name: `${contact.firstName} ${contact.lastName}`,
      email: contact.email,
    },
    loans: loans.map((l) => ({
      id: l.id,
      loanNumber: l.loanNumber,
      property: l.property ? `${l.property.address}, ${l.property.city}` : "—",
      loanAmount: Number(l.loanAmount),
      currentBalance: Number(l.currentBalance),
      interestRate: Number(l.interestRate),
      status: l.status,
      maturityDate: l.maturityDate,
      nextPayment: l.payments[0] ? {
        dueDate: l.payments[0].dueDate,
        amount: Number(l.payments[0].amount),
      } : null,
    })),
  });
}
