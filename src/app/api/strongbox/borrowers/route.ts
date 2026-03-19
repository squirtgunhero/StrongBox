import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const GET = withAuth(async (request) => {
  const search = request.nextUrl.searchParams.get("search")?.trim() || "";

  const where: Prisma.SbBorrowerWhereInput = search
    ? {
        OR: [
          { legal_name: { contains: search, mode: "insensitive" as const } },
          { contact_name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const borrowers = await prisma.sbBorrower.findMany({
    where,
    include: {
      loans: {
        select: {
          id: true,
          loan_stage: true,
          loan_status: true,
          principal_total: true,
          origination_date: true,
          maturity_date: true,
        },
      },
      tax_1098_records: {
        orderBy: { updated_at: "desc" },
      },
    },
    orderBy: [{ legal_name: "asc" }],
    take: 200,
  });

  return NextResponse.json({ borrowers });
}, "view_all_loans");
