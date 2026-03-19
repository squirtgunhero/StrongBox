import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (request) => {
  const fromDate = request.nextUrl.searchParams.get("fromDate")?.trim();
  const toDate = request.nextUrl.searchParams.get("toDate")?.trim();
  const sort = request.nextUrl.searchParams.get("sort")?.trim() || "date_desc";
  const page = Number(request.nextUrl.searchParams.get("page") || 1);
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 24), 100);

  const where: Prisma.SbPortfolioSnapshotWhereInput = {};

  if (fromDate || toDate) {
    where.snapshot_date = {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    };
  }

  const orderBy =
    sort === "date_asc"
      ? [{ snapshot_date: "asc" as const }]
      : sort === "loans_out_desc"
        ? [{ total_loans_out: "desc" as const }, { snapshot_date: "desc" as const }]
        : sort === "company_cash_desc"
          ? [{ total_company_cash: "desc" as const }, { snapshot_date: "desc" as const }]
          : sort === "current_cash_desc"
            ? [{ current_cash_balance: "desc" as const }, { snapshot_date: "desc" as const }]
            : [{ snapshot_date: "desc" as const }];

  const [snapshots, total, latest, earliest] = await Promise.all([
    prisma.sbPortfolioSnapshot.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
    }),
    prisma.sbPortfolioSnapshot.count({ where }),
    prisma.sbPortfolioSnapshot.findFirst({ where, orderBy: { snapshot_date: "desc" } }),
    prisma.sbPortfolioSnapshot.findFirst({ where, orderBy: { snapshot_date: "asc" } }),
  ]);

  return NextResponse.json({
    snapshots,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    sort,
    summary: {
      latestSnapshotDate: latest?.snapshot_date ?? null,
      earliestSnapshotDate: earliest?.snapshot_date ?? null,
      latestLoansOut: Number(latest?.total_loans_out || 0),
      latestCompanyCash: Number(latest?.total_company_cash || 0),
      latestDrawReserve: Number(latest?.total_draw_reserve || 0),
      latestLocBalance: Number(latest?.loc_business_balance || 0),
      latestCurrentCash: Number(latest?.current_cash_balance || 0),
    },
  });
}, "manage_org_settings");