import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { getRiskFlags } from "@/lib/strongbox/calculations";

export const GET = withAuth(async (request) => {
  const ltvThreshold = Number(request.nextUrl.searchParams.get("ltvThreshold") || 0.75);

  const [loans, taxPrepRows] = await Promise.all([
    prisma.sbLoan.findMany({
      include: {
        borrower: true,
        property: true,
        draw_requests: {
          orderBy: { created_at: "desc" },
        },
      },
      orderBy: { updated_at: "desc" },
      take: 500,
    }),
    prisma.sbTax1098Prep.findMany({
      select: {
        borrower_id: true,
        borrower_name: true,
        source_reference: true,
      },
    }),
  ]);

  const taxPrepSourceReferences = new Set(
    taxPrepRows.map((row) => row.source_reference).filter((value): value is string => Boolean(value))
  );
  const taxPrepBorrowers = new Set(
    taxPrepRows
      .map((row) => row.borrower_id || row.borrower_name)
      .filter((value): value is string => Boolean(value))
  );

  const rows = loans.map((loan) => {
    const pendingRequest = loan.draw_requests.find((draw) => ["REQUESTED", "UNDER_REVIEW"].includes(draw.status));
    const approvedDrawsTotal = loan.draw_requests
      .filter((draw) => ["APPROVED", "FUNDED"].includes(draw.status))
      .reduce((sum, draw) => sum + Number(draw.approved_amount || 0), 0);
    const taxPrepReference =
      taxPrepSourceReferences.has(loan.source_row_key || "") ||
      taxPrepBorrowers.has(loan.borrower_id) ||
      taxPrepBorrowers.has(loan.borrower.legal_name)
        ? loan.source_row_key || loan.borrower_id || loan.borrower.legal_name
        : null;

    const flags = getRiskFlags(
      {
        loan_stage: loan.loan_stage,
        loan_status: loan.loan_status,
        loan_type: loan.loan_type,
        principal_total: Number(loan.principal_total || 0),
        purchase_amount: Number(loan.purchase_amount || 0),
        rehab_amount: Number(loan.rehab_amount || 0),
        arv: Number(loan.arv || 0),
        ltv: Number(loan.ltv || 0),
        maturity_date: loan.maturity_date,
        payoff_date: loan.payoff_date,
        approved_draws_total: approvedDrawsTotal,
        requested_draw_amount: pendingRequest ? Number(pendingRequest.amount_requested) : null,
        market_name: loan.property?.market_name,
        borrower_email: loan.borrower.email,
        borrower_phone: loan.borrower.phone,
        title_company: loan.title_company,
        tax_prep_source_reference: taxPrepReference,
      },
      { ltvThreshold }
    );

    return {
      loanId: loan.id,
      borrower: loan.borrower.legal_name,
      property: loan.property?.full_address || null,
      loanStage: loan.loan_stage,
      loanStatus: loan.loan_status,
      flags,
    };
  });

  return NextResponse.json({
    totalLoansEvaluated: rows.length,
    flaggedLoans: rows.filter((row) => row.flags.length > 0),
  });
}, "view_reports");
