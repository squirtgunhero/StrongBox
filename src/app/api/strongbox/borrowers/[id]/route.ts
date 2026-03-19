import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (request) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const borrower = await prisma.sbBorrower.findUnique({
    where: { id },
    include: {
      properties: {
        orderBy: [{ updated_at: "desc" }],
      },
      loans: {
        include: {
          property: true,
        },
        orderBy: [{ updated_at: "desc" }],
      },
      tax_1098_records: {
        orderBy: [{ updated_at: "desc" }],
      },
    },
  });

  if (!borrower) {
    return NextResponse.json({ error: "Borrower not found" }, { status: 404 });
  }

  return NextResponse.json({ borrower });
}, "view_all_loans");
