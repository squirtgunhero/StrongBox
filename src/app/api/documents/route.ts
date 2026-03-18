import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/documents/storage";
import { writeAuditLog } from "@/lib/audit/logger";
import { DocumentCategory } from "@prisma/client";

// GET /api/documents — list documents with filters
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const loanId = searchParams.get("loanId");
  const contactId = searchParams.get("contactId");
  const propertyId = searchParams.get("propertyId");
  const drawId = searchParams.get("drawId");
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const isRequired = searchParams.get("isRequired");
  const isReceived = searchParams.get("isReceived");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
    isLatest: true,
  };

  if (loanId) where.loanId = loanId;
  if (contactId) where.contactId = contactId;
  if (propertyId) where.propertyId = propertyId;
  if (drawId) where.drawId = drawId;
  if (category && Object.values(DocumentCategory).includes(category as DocumentCategory)) {
    where.category = category;
  }
  if (isRequired === "true") where.isRequired = true;
  if (isReceived === "true") where.isReceived = true;
  if (isReceived === "false") where.isReceived = false;
  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { subcategory: { contains: search, mode: "insensitive" } },
    ];
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        loan: { select: { id: true, loanNumber: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.document.count({ where: where as any }),
  ]);

  return NextResponse.json({
    documents,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}, "manage_documents");

// POST /api/documents — upload a document
export const POST = withAuth(async (request, ctx) => {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const loanId = formData.get("loanId") as string | null;
  const contactId = formData.get("contactId") as string | null;
  const propertyId = formData.get("propertyId") as string | null;
  const drawId = formData.get("drawId") as string | null;
  const category = formData.get("category") as string;
  const subcategory = formData.get("subcategory") as string | null;
  const description = formData.get("description") as string | null;
  const isRequired = formData.get("isRequired") === "true";
  const previousVersionId = formData.get("previousVersionId") as string | null;

  if (!category || !Object.values(DocumentCategory).includes(category as DocumentCategory)) {
    return NextResponse.json({ error: "Invalid document category" }, { status: 400 });
  }

  // Validate that the associated entity exists
  if (loanId) {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, organizationId: ctx.organizationId },
    });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }
  }

  // Build storage path: org/entity/category/filename
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const entityFolder = loanId
    ? `loans/${loanId}`
    : contactId
    ? `contacts/${contactId}`
    : propertyId
    ? `properties/${propertyId}`
    : "general";
  const storagePath = `${ctx.organizationId}/${entityFolder}/${category.toLowerCase()}/${timestamp}_${safeName}`;

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(storagePath, buffer, file.type);

  // Handle versioning — mark previous version as not latest
  let version = 1;
  if (previousVersionId) {
    const prev = await prisma.document.findUnique({
      where: { id: previousVersionId },
    });
    if (prev) {
      version = prev.version + 1;
      await prisma.document.update({
        where: { id: previousVersionId },
        data: { isLatest: false },
      });
    }
  }

  const document = await prisma.document.create({
    data: {
      organizationId: ctx.organizationId,
      loanId,
      contactId,
      propertyId,
      drawId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storagePath,
      category: category as DocumentCategory,
      subcategory,
      description,
      isRequired,
      isReceived: true,
      receivedAt: new Date(),
      version,
      previousVersionId,
      isLatest: true,
      uploadedById: ctx.user.id,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "Document",
    entityId: document.id,
    description: `Uploaded document: ${file.name}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    after: { fileName: file.name, category, loanId } as any,
  });

  return NextResponse.json({ document }, { status: 201 });
}, "manage_documents");
