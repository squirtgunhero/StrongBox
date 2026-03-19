import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (request) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const loan = await prisma.sbLoan.findUnique({
    where: { id },
    include: {
      borrower: true,
      property: true,
      draw_requests: {
        include: {
          audit_entries: {
            orderBy: { created_at: "desc" },
            take: 20,
          },
        },
        orderBy: { created_at: "desc" },
      },
      annual_history: {
        orderBy: { closed_year: "desc" },
      },
    },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  return NextResponse.json({ loan });
}, "view_all_loans");
