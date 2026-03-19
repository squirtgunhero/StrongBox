import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (request) => {
  const search = request.nextUrl.searchParams.get("search")?.trim() || "";
  const balanceFilter = request.nextUrl.searchParams.get("balance")?.trim() || "all";
  const freshness = request.nextUrl.searchParams.get("freshness")?.trim() || "all";
  const sort = request.nextUrl.searchParams.get("sort")?.trim() || "updated_desc";
  const page = Number(request.nextUrl.searchParams.get("page") || 1);
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 25), 100);

  const where: Prisma.SbCashAccountWhereInput = {};

  if (search) {
    where.OR = [{ account_name: { contains: search, mode: "insensitive" } }];
  }

  if (balanceFilter === "positive") {
    where.current_balance = { gt: 0 };
  } else if (balanceFilter === "nonpositive") {
    where.current_balance = { lte: 0 };
  }

  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 7);
  if (freshness === "stale") {
    where.updated_on = { lt: staleThreshold };
  } else if (freshness === "recent") {
    where.updated_on = { gte: staleThreshold };
  }

  const orderBy =
    sort === "balance_desc"
      ? [{ current_balance: "desc" as const }, { updated_on: "desc" as const }, { account_name: "asc" as const }]
      : sort === "balance_asc"
        ? [{ current_balance: "asc" as const }, { updated_on: "desc" as const }, { account_name: "asc" as const }]
        : sort === "name_asc"
          ? [{ account_name: "asc" as const }]
          : sort === "name_desc"
            ? [{ account_name: "desc" as const }]
            : sort === "updated_asc"
              ? [{ updated_on: "asc" as const }, { account_name: "asc" as const }]
              : [{ updated_on: "desc" as const }, { account_name: "asc" as const }];

  const [accounts, total, aggregate, latest, recentCount, positiveCount, nonPositiveCount] = await Promise.all([
    prisma.sbCashAccount.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
    }),
    prisma.sbCashAccount.count({ where }),
    prisma.sbCashAccount.aggregate({ where, _sum: { current_balance: true } }),
    prisma.sbCashAccount.findFirst({ where, orderBy: { updated_on: "desc" } }),
    prisma.sbCashAccount.count({
      where: {
        ...where,
        updated_on: { gte: staleThreshold },
      },
    }),
    prisma.sbCashAccount.count({
      where: {
        ...where,
        current_balance: { gt: 0 },
      },
    }),
    prisma.sbCashAccount.count({
      where: {
        ...where,
        current_balance: { lte: 0 },
      },
    }),
  ]);

  const staleCount = await prisma.sbCashAccount.count({
    where: {
      ...where,
      updated_on: { lt: staleThreshold },
    },
  });

  return NextResponse.json({
    accounts,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    sort,
    summary: {
      totalBalance: Number(aggregate._sum.current_balance || 0),
      accountCount: total,
      staleCount,
      recentCount,
      positiveCount,
      nonPositiveCount,
      latestUpdatedOn: latest?.updated_on ?? null,
    },
  });
}, "manage_org_settings");