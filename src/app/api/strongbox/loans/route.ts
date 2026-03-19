import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { Prisma, SbLoanStage, SbLoanStatus } from "@prisma/client";

export const GET = withAuth(async (request) => {
  const search = request.nextUrl.searchParams.get("search")?.trim() || "";
  const stage = request.nextUrl.searchParams.get("stage")?.trim();
  const status = request.nextUrl.searchParams.get("status")?.trim();
  const page = Number(request.nextUrl.searchParams.get("page") || 1);
  const limit = Number(request.nextUrl.searchParams.get("limit") || 50);

  const where: Prisma.SbLoanWhereInput = {};

  if (stage) where.loan_stage = stage.toUpperCase() as SbLoanStage;
  if (status) where.loan_status = status.toUpperCase() as SbLoanStatus;

  if (search) {
    where.OR = [
      { borrower: { legal_name: { contains: search, mode: "insensitive" } } },
      { property: { full_address: { contains: search, mode: "insensitive" } } },
      { source_row_key: { contains: search, mode: "insensitive" } },
      { source_sheet: { contains: search, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.sbLoan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ updated_at: "desc" }],
      include: {
        borrower: true,
        property: true,
        draw_requests: {
          select: {
            amount_requested: true,
            approved_amount: true,
            status: true,
          },
        },
      },
    }),
    prisma.sbLoan.count({ where }),
  ]);

  return NextResponse.json({
    total,
    page,
    limit,
    loans: rows,
  });
}, "view_all_loans");
