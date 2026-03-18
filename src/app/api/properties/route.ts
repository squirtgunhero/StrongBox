import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { propertySchema } from "@/lib/utils/validators";

export const GET = withAuth(async (request, ctx) => {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const state = url.searchParams.get("state");
  const propertyType = url.searchParams.get("propertyType");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
  };

  if (search) {
    where.OR = [
      { address: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { parcelNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  if (state) where.state = state;
  if (propertyType) where.propertyType = propertyType;

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            status: true,
            loanAmount: true,
            borrower: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    }),
    prisma.property.count({ where: where as any }),
  ]);

  return NextResponse.json({ properties, total, page, limit });
}, "view_all_loans");

export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const parsed = propertySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const property = await prisma.property.create({
    data: {
      organizationId: ctx.organizationId,
      ...parsed.data,
    },
  });

  return NextResponse.json({ property }, { status: 201 });
}, "create_loans");
