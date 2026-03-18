import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/sender";
import { differenceInCalendarDays, addDays, subDays } from "date-fns";

// POST /api/scheduled-jobs — run scheduled automation jobs
// Called by cron or manually from admin UI
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { jobType } = body;

  const results: Record<string, unknown> = {};

  switch (jobType) {
    case "maturity_reminders":
      results.maturity = await runMaturityReminders(ctx.organizationId);
      break;
    case "payment_reminders":
      results.payment = await runPaymentReminders(ctx.organizationId);
      break;
    case "document_expiration":
      results.documents = await runDocumentExpirationAlerts(ctx.organizationId);
      break;
    case "delinquency_alerts":
      results.delinquency = await runDelinquencyAlerts(ctx.organizationId);
      break;
    case "all":
      results.maturity = await runMaturityReminders(ctx.organizationId);
      results.payment = await runPaymentReminders(ctx.organizationId);
      results.documents = await runDocumentExpirationAlerts(ctx.organizationId);
      results.delinquency = await runDelinquencyAlerts(ctx.organizationId);
      break;
    default:
      return NextResponse.json({ error: "Invalid job type" }, { status: 400 });
  }

  return NextResponse.json({ success: true, results });
}, "manage_org_settings");

// GET /api/scheduled-jobs — list available jobs and their status
export const GET = withAuth(async (request, ctx) => {
  const jobs = [
    {
      id: "maturity_reminders",
      name: "Maturity Reminders",
      description: "Notify loan officers when loans are approaching maturity (30, 60, 90 days)",
      schedule: "Daily at 8:00 AM",
    },
    {
      id: "payment_reminders",
      name: "Payment Reminders",
      description: "Send payment due reminders to borrowers 7 days and 1 day before due date",
      schedule: "Daily at 9:00 AM",
    },
    {
      id: "document_expiration",
      name: "Document Expiration Alerts",
      description: "Alert when required documents are still pending after 14 days",
      schedule: "Daily at 10:00 AM",
    },
    {
      id: "delinquency_alerts",
      name: "Delinquency Alerts",
      description: "Alert managers when loans become delinquent or cross aging thresholds",
      schedule: "Daily at 7:00 AM",
    },
  ];

  return NextResponse.json({ jobs });
}, "manage_org_settings");

async function runMaturityReminders(orgId: string) {
  const now = new Date();
  const thresholds = [30, 60, 90];
  let notificationsSent = 0;

  for (const days of thresholds) {
    const targetDate = addDays(now, days);
    const rangeStart = subDays(targetDate, 1);
    const rangeEnd = addDays(targetDate, 1);

    const loans = await prisma.loan.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["FUNDED", "ACTIVE", "EXTENDED"] as any },
        maturityDate: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        id: true,
        loanNumber: true,
        maturityDate: true,
        loanOfficerId: true,
        borrower: { select: { firstName: true, lastName: true } },
      },
    });

    for (const loan of loans) {
      if (loan.loanOfficerId) {
        await sendNotification({
          userId: loan.loanOfficerId,
          type: "LOAN_MATURITY_WARNING",
          title: `Loan Maturing in ${days} Days`,
          message: `${loan.loanNumber} (${loan.borrower.firstName} ${loan.borrower.lastName}) matures on ${loan.maturityDate?.toLocaleDateString()}`,
          loanId: loan.id,
          actionUrl: `/loans/${loan.id}`,
        });
        notificationsSent++;
      }
    }
  }

  return { notificationsSent };
}

async function runPaymentReminders(orgId: string) {
  const now = new Date();
  const reminderDays = [7, 1];
  let notificationsSent = 0;

  for (const days of reminderDays) {
    const targetDate = addDays(now, days);
    const rangeStart = subDays(targetDate, 1);
    const rangeEnd = addDays(targetDate, 1);

    const payments = await prisma.payment.findMany({
      where: {
        status: "SCHEDULED",
        dueDate: { gte: rangeStart, lte: rangeEnd },
        loan: { organizationId: orgId },
      },
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            borrower: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    for (const payment of payments) {
      // Notify borrower if they have a user account (match by email)
      const borrowerEmail = payment.loan.borrower?.email;
      const borrowerUser = borrowerEmail
        ? await prisma.user.findFirst({ where: { email: borrowerEmail } })
        : null;

      if (borrowerUser) {
        await sendNotification({
          userId: borrowerUser.id,
          type: "PAYMENT_DUE",
          title: `Payment Due in ${days} Day${days > 1 ? "s" : ""}`,
          message: `Payment of $${Number(payment.amount).toLocaleString()} for loan ${payment.loan.loanNumber} is due on ${payment.dueDate.toLocaleDateString()}`,
          loanId: payment.loan.id,
        });
        notificationsSent++;
      }
    }
  }

  return { notificationsSent };
}

async function runDocumentExpirationAlerts(orgId: string) {
  const fourteenDaysAgo = subDays(new Date(), 14);
  let alertsSent = 0;

  const pendingDocs = await prisma.document.findMany({
    where: {
      organizationId: orgId,
      isRequired: true,
      isReceived: false,
      requestedAt: { lte: fourteenDaysAgo },
    },
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          loanOfficerId: true,
        },
      },
    },
  });

  for (const doc of pendingDocs) {
    if (doc.loan?.loanOfficerId) {
      await sendNotification({
        userId: doc.loan.loanOfficerId,
        type: "DOCUMENT_REQUESTED",
        title: "Overdue Document",
        message: `"${doc.fileName}" for loan ${doc.loan.loanNumber} has been pending for over 14 days`,
        loanId: doc.loan.id,
        actionUrl: `/loans/${doc.loan.id}`,
      });
      alertsSent++;
    }
  }

  return { alertsSent, pendingDocuments: pendingDocs.length };
}

async function runDelinquencyAlerts(orgId: string) {
  const thresholds = [1, 30, 60, 90];
  let alertsSent = 0;

  for (const threshold of thresholds) {
    const loans = await prisma.loan.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["FUNDED", "ACTIVE", "EXTENDED"] as any },
        daysDelinquent: { gte: threshold, lt: threshold + 1 },
      },
      select: {
        id: true,
        loanNumber: true,
        daysDelinquent: true,
        loanOfficerId: true,
        borrower: { select: { firstName: true, lastName: true } },
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: { in: ["ADMIN", "SUPER_ADMIN"] as any },
        isActive: true,
      },
      select: { id: true },
    });

    for (const loan of loans) {
      for (const admin of admins) {
        await sendNotification({
          userId: admin.id,
          type: "PAYMENT_LATE",
          title: `Loan ${threshold}+ Days Delinquent`,
          message: `${loan.loanNumber} (${loan.borrower.firstName} ${loan.borrower.lastName}) is ${loan.daysDelinquent} days delinquent`,
          loanId: loan.id,
          actionUrl: `/loans/${loan.id}`,
        });
        alertsSent++;
      }
    }
  }

  return { alertsSent };
}
