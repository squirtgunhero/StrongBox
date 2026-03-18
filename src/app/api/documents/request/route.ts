import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { sendNotification } from "@/lib/notifications/sender";
import { DocumentCategory } from "@prisma/client";

// POST /api/documents/request — create document request (placeholder entries for required docs)
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { loanId, documents } = body;

  if (!loanId || !Array.isArray(documents) || documents.length === 0) {
    return NextResponse.json(
      { error: "loanId and documents array are required" },
      { status: 400 }
    );
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, organizationId: ctx.organizationId },
    include: { borrower: true },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  // Create placeholder document records for each requested item
  const created = await Promise.all(
    documents.map(
      async (doc: { category: string; subcategory?: string; description?: string }) => {
        if (!Object.values(DocumentCategory).includes(doc.category as DocumentCategory)) {
          return null;
        }
        return prisma.document.create({
          data: {
            organizationId: ctx.organizationId,
            loanId,
            fileName: `${doc.subcategory || doc.category} — Requested`,
            fileType: "pending",
            fileSize: 0,
            storagePath: "",
            category: doc.category as DocumentCategory,
            subcategory: doc.subcategory || null,
            description: doc.description || null,
            isRequired: true,
            isReceived: false,
            requestedAt: new Date(),
            uploadedById: ctx.user.id,
          },
        });
      }
    )
  );

  const validDocs = created.filter(Boolean);

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "Document",
    entityId: loanId,
    description: `Requested ${validDocs.length} documents for loan ${loan.loanNumber}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    after: { requestedDocuments: documents } as any,
  });

  return NextResponse.json({ documents: validDocs, count: validDocs.length }, { status: 201 });
}, "manage_documents");
