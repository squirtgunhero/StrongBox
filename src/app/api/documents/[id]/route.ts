import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { getSignedUrl, deleteFile } from "@/lib/documents/storage";
import { writeAuditLog } from "@/lib/audit/logger";

// GET /api/documents/[id] — get document detail with signed URL
export const GET = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const document = await prisma.document.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      loan: { select: { id: true, loanNumber: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      property: { select: { id: true, address: true, city: true, state: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Generate a fresh signed URL
  let storageUrl: string | null = null;
  try {
    storageUrl = await getSignedUrl(document.storagePath, 3600);
  } catch {
    // Storage URL generation may fail in dev without Supabase
  }

  return NextResponse.json({ document: { ...document, storageUrl } });
}, "manage_documents");

// PATCH /api/documents/[id] — update document metadata
export const PATCH = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  const body = await request.json();

  const document = await prisma.document.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const allowedFields = [
    "description",
    "subcategory",
    "tags",
    "isRequired",
    "isReceived",
    "reviewStatus",
    "reviewNotes",
    "reviewedAt",
    "reviewedById",
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  // If marking as received, set receivedAt
  if (body.isReceived === true && !document.isReceived) {
    updateData.receivedAt = new Date();
  }

  // If setting review status, track reviewer
  if (body.reviewStatus && body.reviewStatus !== document.reviewStatus) {
    updateData.reviewedAt = new Date();
    updateData.reviewedById = ctx.user.id;
  }

  const updated = await prisma.document.update({
    where: { id },
    data: updateData,
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "UPDATE",
    entityType: "Document",
    entityId: id,
    description: `Updated document: ${document.fileName}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: document as any,
    after: updated as any,
  });

  return NextResponse.json({ document: updated });
}, "manage_documents");

// DELETE /api/documents/[id] — delete a document
export const DELETE = withAuth(async (request, ctx) => {
  const id = request.nextUrl.pathname.split("/").pop()!;

  const document = await prisma.document.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete from storage
  try {
    await deleteFile(document.storagePath);
  } catch {
    // Continue even if storage delete fails
  }

  await prisma.document.delete({ where: { id } });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "DELETE",
    entityType: "Document",
    entityId: id,
    description: `Deleted document: ${document.fileName}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    before: { fileName: document.fileName, category: document.category } as any,
  });

  return NextResponse.json({ success: true });
}, "manage_documents");
