import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/documents/storage";

// POST /api/documents/bulk-download — get signed URLs for multiple documents
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { documentIds, loanId } = body;

  let docs;
  if (loanId) {
    // Download all documents for a loan
    docs = await prisma.document.findMany({
      where: {
        loanId,
        organizationId: ctx.organizationId,
        isLatest: true,
        isReceived: true,
        fileSize: { gt: 0 },
      },
      select: { id: true, fileName: true, storagePath: true, category: true },
    });
  } else if (documentIds?.length > 0) {
    docs = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        organizationId: ctx.organizationId,
        fileSize: { gt: 0 },
      },
      select: { id: true, fileName: true, storagePath: true, category: true },
    });
  } else {
    return NextResponse.json({ error: "documentIds or loanId required" }, { status: 400 });
  }

  // Generate signed URLs for each document
  const downloads = await Promise.all(
    docs.map(async (doc) => {
      try {
        const url = await getSignedUrl(doc.storagePath, 3600);
        return { id: doc.id, fileName: doc.fileName, category: doc.category, url };
      } catch {
        return { id: doc.id, fileName: doc.fileName, category: doc.category, url: null, error: "URL generation failed" };
      }
    })
  );

  return NextResponse.json({ downloads, count: downloads.length });
}, "manage_documents");
