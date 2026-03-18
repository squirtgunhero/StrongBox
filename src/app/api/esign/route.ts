import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { sendNotification } from "@/lib/notifications/sender";

// POST /api/esign — send document for e-signature via DocuSign
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { documentId, signerName, signerEmail, subject, message } = body;

  if (!documentId || !signerEmail) {
    return NextResponse.json({ error: "documentId and signerEmail are required" }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: ctx.organizationId },
    include: { loan: { select: { id: true, loanNumber: true } } },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // DocuSign integration
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const secretKey = process.env.DOCUSIGN_SECRET_KEY;
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;

  if (!integrationKey || !secretKey || !accountId) {
    // Dev mode — simulate
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        requiresSignature: true,
        signatureStatus: "SENT",
        signatureProvider: "DOCUSIGN",
        signatureId: `dev-envelope-${Date.now()}`,
      },
    });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      action: "UPDATE",
      entityType: "Document",
      entityId: documentId,
      description: `Sent document "${document.fileName}" for e-signature to ${signerEmail} (dev mode)`,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });

    return NextResponse.json({
      success: true,
      mode: "development",
      envelopeId: updated.signatureId,
      message: "E-signature request simulated (no DocuSign credentials configured)",
    });
  }

  // Production DocuSign flow
  try {
    // Step 1: Get OAuth token
    const tokenRes = await fetch("https://account-d.docusign.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: integrationKey,
        client_secret: secretKey,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(tokenData.error || "Failed to authenticate with DocuSign");
    }

    // Step 2: Create envelope
    const envelopeRes = await fetch(
      `https://demo.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailSubject: subject || `Please sign: ${document.fileName}`,
          emailBlurb: message || "Please review and sign this document.",
          status: "sent",
          recipients: {
            signers: [
              {
                email: signerEmail,
                name: signerName || signerEmail,
                recipientId: "1",
                routingOrder: "1",
                tabs: { signHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "100", yPosition: "700" }] },
              },
            ],
          },
          documents: [
            {
              documentId: "1",
              name: document.fileName,
              fileExtension: document.fileName.split(".").pop() || "pdf",
              documentBase64: "", // In production, fetch from Supabase Storage
            },
          ],
        }),
      }
    );

    const envelopeData = await envelopeRes.json();

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        requiresSignature: true,
        signatureStatus: "SENT",
        signatureProvider: "DOCUSIGN",
        signatureId: envelopeData.envelopeId,
      },
    });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      action: "UPDATE",
      entityType: "Document",
      entityId: documentId,
      description: `Sent document "${document.fileName}" for e-signature via DocuSign to ${signerEmail}`,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });

    return NextResponse.json({
      success: true,
      envelopeId: envelopeData.envelopeId,
      status: envelopeData.status,
    });
  } catch (err) {
    return NextResponse.json({ error: `DocuSign error: ${err}` }, { status: 500 });
  }
}, "manage_documents");

// GET /api/esign?documentId=xxx — check signature status
export const GET = withAuth(async (request, ctx) => {
  const documentId = request.nextUrl.searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: ctx.organizationId },
    select: {
      id: true,
      fileName: true,
      requiresSignature: true,
      signatureStatus: true,
      signatureProvider: true,
      signatureId: true,
      signedAt: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ document });
}, "manage_documents");
