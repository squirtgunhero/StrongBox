import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";

// GET /api/communications — list communications with filters
export const GET = withAuth(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const loanId = searchParams.get("loanId");
  const contactId = searchParams.get("contactId");
  const type = searchParams.get("type");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  // Filter by loan's org via join
  if (loanId) where.loanId = loanId;
  if (contactId) where.contactId = contactId;
  if (type) where.type = type;

  // If neither loan nor contact specified, filter by org via loan or author
  if (!loanId && !contactId) {
    where.OR = [
      { loan: { organizationId: ctx.organizationId } },
      { author: { organizationId: ctx.organizationId } },
    ];
  }

  const [communications, total] = await Promise.all([
    prisma.communication.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        loan: { select: { id: true, loanNumber: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.communication.count({ where: where as any }),
  ]);

  return NextResponse.json({ communications, total, page, limit, totalPages: Math.ceil(total / limit) });
});

// POST /api/communications — send an email, SMS, or log a communication
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { type, loanId, contactId, subject, body: messageBody, toEmails, toPhone, direction } = body;

  if (!type || !["EMAIL", "SMS", "PHONE_CALL", "IN_APP_NOTE"].includes(type)) {
    return NextResponse.json({ error: "Invalid communication type" }, { status: 400 });
  }

  let externalResult: Record<string, unknown> = {};

  // Send email via Resend
  if (type === "EMAIL" && toEmails?.length > 0 && process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "noreply@strongbox.app",
          to: toEmails,
          cc: body.ccEmails || [],
          subject: subject || "StrongBox Notification",
          html: messageBody,
        }),
      });
      const data = await res.json();
      externalResult = { resendId: data.id, status: res.ok ? "sent" : "failed" };
    } catch (err) {
      externalResult = { status: "failed", error: String(err) };
    }
  }

  // Send SMS via Twilio
  if (type === "SMS" && toPhone && process.env.TWILIO_ACCOUNT_SID) {
    try {
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
            To: toPhone,
            From: process.env.TWILIO_PHONE_NUMBER || "",
            Body: messageBody || "",
          }),
        }
      );
      const data = await res.json();
      externalResult = { twilioSid: data.sid, status: res.ok ? "sent" : "failed" };
    } catch (err) {
      externalResult = { status: "failed", error: String(err) };
    }
  }

  const communication = await prisma.communication.create({
    data: {
      loanId: loanId || null,
      contactId: contactId || null,
      type,
      direction: direction || "OUTBOUND",
      subject: subject || null,
      body: messageBody || null,
      authorId: ctx.user.id,
      fromEmail: type === "EMAIL" ? (process.env.EMAIL_FROM || "noreply@strongbox.app") : null,
      toEmails: toEmails || [],
      ccEmails: body.ccEmails || [],
      fromPhone: type === "SMS" ? (process.env.TWILIO_PHONE_NUMBER || null) : null,
      toPhone: toPhone || null,
      twilioSid: (externalResult.twilioSid as string) || null,
      metadata: externalResult as any,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    action: "CREATE",
    entityType: "Communication",
    entityId: communication.id,
    description: `Sent ${type} ${loanId ? `for loan` : ""}`,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
  });

  return NextResponse.json({ communication, externalResult }, { status: 201 });
});
