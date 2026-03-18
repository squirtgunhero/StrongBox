import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";

// POST /api/communications/bulk — send bulk email/SMS campaigns
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { type, subject, body: messageBody, templateId, recipients, filters } = body;

  if (!type || !["EMAIL", "SMS"].includes(type)) {
    return NextResponse.json({ error: "type must be EMAIL or SMS" }, { status: 400 });
  }

  // Resolve recipients from filters or explicit list
  let resolvedRecipients: { id: string; email: string | null; phone: string | null; firstName: string; lastName: string }[] = [];

  if (recipients?.length) {
    // Explicit contact IDs
    resolvedRecipients = await prisma.contact.findMany({
      where: {
        id: { in: recipients },
        organizationId: ctx.organizationId,
      },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true },
    });
  } else if (filters) {
    // Filter-based: e.g., all borrowers, all investors, contacts on active loans
    const where: Record<string, unknown> = { organizationId: ctx.organizationId };

    if (filters.isBorrower) where.isBorrower = true;
    if (filters.isInvestor) where.isInvestor = true;
    if (filters.hasActiveLoan) {
      where.loansAsBorrower = { some: { status: { in: ["ACTIVE", "FUNDED"] } } };
    }
    if (filters.loanStatus) {
      where.loansAsBorrower = { some: { status: filters.loanStatus } };
    }

    resolvedRecipients = await prisma.contact.findMany({
      where: where as any,
      select: { id: true, email: true, phone: true, firstName: true, lastName: true },
    });
  }

  if (!resolvedRecipients.length) {
    return NextResponse.json({ error: "No recipients matched" }, { status: 400 });
  }

  // Load template if specified
  let finalSubject = subject || "";
  let finalBody = messageBody || "";

  // Templates are resolved client-side before sending bulk;
  // templateId is kept for audit trail purposes only

  const results = {
    total: resolvedRecipients.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as { contactId: string; error: string }[],
  };

  for (const contact of resolvedRecipients) {
    try {
      // Interpolate contact variables
      const interpolated = {
        subject: interpolate(finalSubject, contact),
        body: interpolate(finalBody, contact),
      };

      if (type === "EMAIL") {
        if (!contact.email) {
          results.skipped++;
          continue;
        }

        if (process.env.RESEND_API_KEY) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || "noreply@strongbox.app",
              to: [contact.email],
              subject: interpolated.subject,
              html: interpolated.body,
            }),
          });

          if (!res.ok) throw new Error(`Resend error: ${res.status}`);
        }

        // Log communication
        await prisma.communication.create({
          data: {
            contactId: contact.id,
            type: "EMAIL",
            direction: "OUTBOUND",
            subject: interpolated.subject,
            body: interpolated.body,
            authorId: ctx.user.id,
            fromEmail: process.env.EMAIL_FROM || "noreply@strongbox.app",
            toEmails: [contact.email],
            ccEmails: [],
            metadata: { bulk: true },
          },
        });

        results.sent++;
      }

      if (type === "SMS") {
        if (!contact.phone) {
          results.skipped++;
          continue;
        }

        if (process.env.TWILIO_ACCOUNT_SID) {
          const authString = Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString("base64");

          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${authString}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: contact.phone,
                From: process.env.TWILIO_PHONE_NUMBER || "",
                Body: interpolated.body,
              }),
            }
          );

          if (!res.ok) throw new Error(`Twilio error: ${res.status}`);
        }

        await prisma.communication.create({
          data: {
            contactId: contact.id,
            type: "SMS",
            direction: "OUTBOUND",
            body: interpolated.body,
            authorId: ctx.user.id,
            fromPhone: process.env.TWILIO_PHONE_NUMBER || null,
            toPhone: contact.phone,
            toEmails: [],
            ccEmails: [],
            metadata: { bulk: true },
          },
        });

        results.sent++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ contactId: contact.id, error: String(err) });
    }
  }

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "BulkCommunication",
    entityId: type,
    description: `Bulk ${type}: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped of ${results.total}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
  });

  return NextResponse.json({ results });
}, "manage_org_settings");

function interpolate(template: string, contact: { firstName: string; lastName: string; email: string | null; phone: string | null }) {
  return template
    .replace(/\{\{firstName\}\}/g, contact.firstName || "")
    .replace(/\{\{lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{email\}\}/g, contact.email || "")
    .replace(/\{\{phone\}\}/g, contact.phone || "")
    .replace(/\{\{fullName\}\}/g, `${contact.firstName} ${contact.lastName}`.trim());
}
