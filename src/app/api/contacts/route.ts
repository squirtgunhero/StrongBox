import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { contactSchema } from "@/lib/utils/validators";

export const GET = withAuth(async (request, ctx) => {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const type = url.searchParams.get("type"); // borrower, investor, referral, vendor
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const sortBy = url.searchParams.get("sortBy") || "lastName";
  const sortOrder = url.searchParams.get("sortOrder") || "asc";

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
  };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type === "borrower") where.isBorrower = true;
  if (type === "investor") where.isInvestor = true;
  if (type === "referral") where.isReferralPartner = true;
  if (type === "vendor") where.isVendor = true;

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where: where as any,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { loans: true } },
      },
    }),
    prisma.contact.count({ where: where as any }),
  ]);

  return NextResponse.json({ contacts, total, page, limit });
});

export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const contact = await prisma.contact.create({
    data: {
      organizationId: ctx.organizationId,
      ...parsed.data,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "Contact",
    entityId: contact.id,
    description: `Created contact ${contact.firstName} ${contact.lastName}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
  });

  return NextResponse.json({ contact }, { status: 201 });
});
