import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter } from "date-fns";

// GET /api/statements — generate investor statement
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const contactId = searchParams.get("investorId"); // contactId of the investor
  const period = searchParams.get("period") || "monthly"; // monthly | quarterly
  const dateStr = searchParams.get("date"); // YYYY-MM
  const fmt = searchParams.get("format") || "json"; // json | csv

  if (!contactId) {
    return NextResponse.json({ error: "investorId required" }, { status: 400 });
  }

  const baseDate = dateStr ? new Date(`${dateStr}-01`) : subMonths(new Date(), 1);
  const periodStart = period === "quarterly" ? startOfQuarter(baseDate) : startOfMonth(baseDate);
  const periodEnd = period === "quarterly" ? endOfQuarter(baseDate) : endOfMonth(baseDate);

  // Get investor capital account
  const account = await prisma.investorCapitalAccount.findUnique({
    where: { contactId },
  });

  if (!account) {
    return NextResponse.json({ error: "No capital account found for this investor" }, { status: 404 });
  }

  // Get transactions in period
  const transactions = await prisma.investorTransaction.findMany({
    where: {
      accountId: account.id,
      transactionDate: { gte: periodStart, lte: periodEnd },
    },
    orderBy: { transactionDate: "asc" },
  });

  // Get capital allocations for loans this investor has funded
  // Find capital sources linked to this contact's organization
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { organizationId: true, firstName: true, lastName: true },
  });

  const allocations = contact
    ? await prisma.capitalAllocation.findMany({
        where: {
          capitalSource: { organizationId: contact.organizationId },
          isActive: true,
        },
        include: {
          loan: {
            select: {
              id: true,
              loanNumber: true,
              loanAmount: true,
              currentBalance: true,
              interestRate: true,
              status: true,
              fundingDate: true,
              maturityDate: true,
              borrower: { select: { firstName: true, lastName: true } },
              property: { select: { address: true, city: true, state: true } },
            },
          },
        },
      })
    : [];

  // Calculate period metrics
  const totalDeployed = Number(account.totalDeployed);
  const totalReturned = Number(account.totalReturned);
  const totalInterestEarned = Number(account.totalInterestEarned);
  const currentBalance = Number(account.currentBalance);

  const periodContributions = transactions
    .filter((t) => t.type === "CONTRIBUTION")
    .reduce((s, t) => s + Number(t.amount), 0);
  const periodDistributions = transactions
    .filter((t) => t.type === "DISTRIBUTION")
    .reduce((s, t) => s + Number(t.amount), 0);
  const periodInterest = transactions
    .filter((t) => t.type === "INTEREST")
    .reduce((s, t) => s + Number(t.amount), 0);

  const statement = {
    investorId: contactId,
    period: period === "quarterly" ? `Q${Math.ceil((baseDate.getMonth() + 1) / 3)} ${baseDate.getFullYear()}` : format(baseDate, "MMMM yyyy"),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    summary: {
      currentBalance,
      totalDeployed,
      totalReturned,
      totalInterestEarned,
      periodContributions,
      periodDistributions,
      periodInterest,
      netPeriodActivity: periodContributions - periodDistributions + periodInterest,
    },
    transactions: transactions.map((t) => ({
      date: t.transactionDate,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      referenceNumber: t.referenceNumber,
    })),
    portfolio: allocations.map((a) => ({
      loanNumber: a.loan.loanNumber,
      borrower: `${a.loan.borrower.firstName} ${a.loan.borrower.lastName}`,
      property: a.loan.property
        ? `${a.loan.property.address}, ${a.loan.property.city} ${a.loan.property.state}`
        : null,
      allocationAmount: Number(a.amount),
      loanBalance: Number(a.loan.currentBalance),
      interestRate: Number(a.loan.interestRate),
      status: a.loan.status,
      fundingDate: a.loan.fundingDate,
      maturityDate: a.loan.maturityDate,
    })),
  };

  if (fmt === "csv") {
    const lines = [
      `Investor Statement — ${statement.period}`,
      `Generated: ${format(new Date(), "MM/dd/yyyy")}`,
      "",
      "SUMMARY",
      `Current Balance,${currentBalance}`,
      `Total Deployed,${totalDeployed}`,
      `Total Returned,${totalReturned}`,
      `Total Interest Earned,${totalInterestEarned}`,
      `Period Contributions,${periodContributions}`,
      `Period Distributions,${periodDistributions}`,
      `Period Interest,${periodInterest}`,
      "",
      "TRANSACTIONS",
      "Date,Type,Amount,Description,Reference",
      ...statement.transactions.map(
        (t) => `${format(new Date(t.date), "MM/dd/yyyy")},${t.type},${t.amount},"${t.description || ""}",${t.referenceNumber || ""}`
      ),
      "",
      "PORTFOLIO",
      "Loan,Borrower,Property,Allocation,Balance,Rate,Status,Funded,Maturity",
      ...statement.portfolio.map(
        (p) =>
          `${p.loanNumber},"${p.borrower}","${p.property || ""}",${p.allocationAmount},${p.loanBalance},${p.interestRate}%,${p.status},${p.fundingDate ? format(new Date(p.fundingDate), "MM/dd/yyyy") : ""},${p.maturityDate ? format(new Date(p.maturityDate), "MM/dd/yyyy") : ""}`
      ),
    ];

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="statement-${format(baseDate, "yyyy-MM")}.csv"`,
      },
    });
  }

  return NextResponse.json(statement);
}, "manage_capital");
