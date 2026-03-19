import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

type DashboardSummaryRow = {
  active_exposure_total: string | number;
  loan_count_active: number;
  upcoming_maturities_within_30_days: number;
  pending_draw_requests: number;
  current_cash: string | number;
  total_upcoming_cash_needed: string | number;
};

export const GET = withAuth(async () => {
  const [rows, latestSnapshot, cashAgg, activeLoanAgg] = await Promise.all([
    prisma.$queryRawUnsafe<DashboardSummaryRow[]>("SELECT * FROM dashboard_portfolio_summary LIMIT 1"),
    prisma.sbPortfolioSnapshot.findFirst({ orderBy: { snapshot_date: "desc" } }),
    prisma.sbCashAccount.aggregate({ _sum: { current_balance: true } }),
    prisma.sbLoan.aggregate({
      where: {
        loan_stage: "ACTIVE",
        loan_status: { in: ["FUNDED", "ACTIVE", "MATURED"] },
      },
      _sum: { draw_reserve: true },
    }),
  ]);

  const row = rows[0] ?? {
    active_exposure_total: 0,
    loan_count_active: 0,
    upcoming_maturities_within_30_days: 0,
    pending_draw_requests: 0,
    current_cash: 0,
    total_upcoming_cash_needed: 0,
  };

  const currentCash = Number(
    latestSnapshot?.current_cash_balance ?? cashAgg._sum.current_balance ?? row.current_cash ?? 0
  );
  const activeExposure = Number(row.active_exposure_total || 0);
  const loansOut = Number(latestSnapshot?.total_loans_out ?? activeExposure);
  const drawReserve = Number(latestSnapshot?.total_draw_reserve ?? activeLoanAgg._sum.draw_reserve ?? 0);
  const upcomingFundingNeed = Number(row.total_upcoming_cash_needed || 0);
  const totalCompanyCash = Number(latestSnapshot?.total_company_cash ?? currentCash);
  const fundingPressure = Math.max(0, upcomingFundingNeed + drawReserve - currentCash);

  return NextResponse.json({
    currentCash,
    loansOut,
    activeExposure,
    totalCompanyCash,
    drawReserve,
    fundingPressure,
    upcomingFundingNeed,
    pendingDrawRequests: Number(row.pending_draw_requests || 0),
    maturitiesIn30Days: Number(row.upcoming_maturities_within_30_days || 0),
    activeLoanCount: Number(row.loan_count_active || 0),
    snapshotAsOf: latestSnapshot?.snapshot_date?.toISOString() ?? null,
  });
}, "view_all_loans");
