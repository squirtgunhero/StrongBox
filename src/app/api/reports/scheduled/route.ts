import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";

// GET /api/reports/scheduled — list scheduled report configs
export const GET = withAuth(async (request, ctx) => {
  const schedules = await prisma.scheduledReport.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ schedules });
}, "view_reports");

// POST /api/reports/scheduled — create or run a scheduled report
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { action } = body;

  // Create a new scheduled report
  if (action === "create") {
    const { name, reportType, config, schedule, recipients } = body;

    if (!name || !reportType || !recipients?.length) {
      return NextResponse.json(
        { error: "name, reportType, and recipients[] required" },
        { status: 400 }
      );
    }

    const report = await prisma.scheduledReport.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        reportType,
        config: config || {},
        schedule: schedule || "weekly",
        recipients,
        isActive: true,
        createdById: ctx.user.id,
      },
    });

    await writeAuditLog({
      organizationId: ctx.organizationId,
      action: "CREATE",
      entityType: "ScheduledReport",
      entityId: report.id,
      description: `Created scheduled report: ${name}`,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });

    return NextResponse.json({ report }, { status: 201 });
  }

  // Run a report now (generate and email)
  if (action === "run") {
    const { scheduleId } = body;

    const schedule = await prisma.scheduledReport.findFirst({
      where: { id: scheduleId, organizationId: ctx.organizationId },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Generate report data based on type
    const reportData = await generateReport(schedule.reportType, schedule.config as any, ctx.organizationId);

    // Send via email
    if (process.env.RESEND_API_KEY && schedule.recipients.length > 0) {
      const htmlContent = formatReportHTML(schedule.name, schedule.reportType, reportData);

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "noreply@strongbox.app",
          to: schedule.recipients,
          subject: `StrongBox Report: ${schedule.name} — ${new Date().toLocaleDateString()}`,
          html: htmlContent,
        }),
      });
    }

    // Update last run
    await prisma.scheduledReport.update({
      where: { id: schedule.id },
      data: { lastRunAt: new Date() },
    });

    return NextResponse.json({ success: true, reportData });
  }

  // Toggle active
  if (action === "toggle") {
    const { scheduleId } = body;
    const schedule = await prisma.scheduledReport.findFirst({
      where: { id: scheduleId, organizationId: ctx.organizationId },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.scheduledReport.update({
      where: { id: schedule.id },
      data: { isActive: !schedule.isActive },
    });

    return NextResponse.json({ schedule: updated });
  }

  // Delete
  if (action === "delete") {
    const { scheduleId } = body;
    await prisma.scheduledReport.delete({ where: { id: scheduleId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}, "view_reports");

// Report generators
async function generateReport(
  reportType: string,
  config: Record<string, unknown>,
  orgId: string
) {
  switch (reportType) {
    case "portfolio_summary": {
      const loans = await prisma.loan.findMany({
        where: { organizationId: orgId, status: { in: ["ACTIVE", "FUNDED"] } },
        include: { borrower: true, property: true },
      });
      const totalAmount = loans.reduce((sum, l) => sum + (l.loanAmount?.toNumber?.() || Number(l.loanAmount) || 0), 0);
      return {
        type: "portfolio_summary",
        generatedAt: new Date().toISOString(),
        summary: {
          activeLoans: loans.length,
          totalPortfolio: totalAmount,
          avgLoanSize: loans.length > 0 ? totalAmount / loans.length : 0,
        },
        loans: loans.map((l) => ({
          loanNumber: l.loanNumber,
          borrower: `${l.borrower?.firstName || ""} ${l.borrower?.lastName || ""}`.trim(),
          amount: l.loanAmount?.toNumber?.() || Number(l.loanAmount) || 0,
          status: l.status,
          property: l.property ? `${l.property.address}, ${l.property.city}` : "",
        })),
      };
    }

    case "delinquency": {
      // Find loans with overdue payments
      const loans = await prisma.loan.findMany({
        where: {
          organizationId: orgId,
          status: { in: ["ACTIVE", "FUNDED"] },
          payments: { some: { status: "LATE", dueDate: { lt: new Date() } } },
        },
        include: {
          borrower: true,
          payments: { where: { status: "LATE" }, orderBy: { dueDate: "asc" }, take: 1 },
        },
      });

      const now = Date.now();
      const delinquentLoans = loans.map((l) => {
        const oldestLate = l.payments[0]?.dueDate;
        const daysLate = oldestLate
          ? Math.floor((now - new Date(oldestLate).getTime()) / 86400000)
          : 0;
        return {
          loanNumber: l.loanNumber,
          borrower: `${l.borrower?.firstName || ""} ${l.borrower?.lastName || ""}`.trim(),
          amount: l.loanAmount?.toNumber?.() || Number(l.loanAmount) || 0,
          delinquentDays: daysLate,
        };
      }).sort((a, b) => b.delinquentDays - a.delinquentDays);

      return {
        type: "delinquency",
        generatedAt: new Date().toISOString(),
        totalDelinquent: delinquentLoans.length,
        loans: delinquentLoans,
      };
    }

    case "maturity": {
      const threeMonths = new Date();
      threeMonths.setMonth(threeMonths.getMonth() + 3);

      const loans = await prisma.loan.findMany({
        where: {
          organizationId: orgId,
          status: { in: ["ACTIVE", "FUNDED"] },
          maturityDate: { lte: threeMonths },
        },
        include: { borrower: true },
        orderBy: { maturityDate: "asc" },
      });

      return {
        type: "maturity",
        generatedAt: new Date().toISOString(),
        maturingIn90Days: loans.length,
        loans: loans.map((l) => ({
          loanNumber: l.loanNumber,
          borrower: `${l.borrower?.firstName || ""} ${l.borrower?.lastName || ""}`.trim(),
          maturityDate: l.maturityDate?.toISOString(),
          amount: l.loanAmount?.toNumber?.() || Number(l.loanAmount) || 0,
        })),
      };
    }

    case "payment_collection": {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const payments = await prisma.payment.findMany({
        where: {
          loan: { organizationId: orgId },
          paidDate: { gte: thirtyDaysAgo },
        },
        include: { loan: { select: { loanNumber: true } } },
        orderBy: { paidDate: "desc" },
      });

      const totalCollected = payments.reduce(
        (sum, p) => sum + (p.amount?.toNumber?.() || Number(p.amount) || 0),
        0
      );

      return {
        type: "payment_collection",
        generatedAt: new Date().toISOString(),
        period: "Last 30 days",
        totalCollected,
        paymentCount: payments.length,
        payments: payments.slice(0, 50).map((p) => ({
          loanNumber: p.loan?.loanNumber,
          amount: p.amount?.toNumber?.() || Number(p.amount) || 0,
          paidDate: p.paidDate?.toISOString(),
        })),
      };
    }

    default:
      return { type: reportType, error: "Unknown report type" };
  }
}

function formatReportHTML(name: string, type: string, data: Record<string, unknown>) {
  const summary = data.summary as Record<string, unknown> | undefined;
  const loans = (data.loans as any[]) || [];

  let rows = "";
  if (type === "portfolio_summary") {
    rows = loans
      .map(
        (l: any) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${l.loanNumber}</td><td style="padding:8px;border-bottom:1px solid #eee">${l.borrower}</td><td style="padding:8px;border-bottom:1px solid #eee">$${(l.amount || 0).toLocaleString()}</td><td style="padding:8px;border-bottom:1px solid #eee">${l.status}</td></tr>`
      )
      .join("");
  } else if (type === "delinquency") {
    rows = loans
      .map(
        (l: any) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${l.loanNumber}</td><td style="padding:8px;border-bottom:1px solid #eee">${l.borrower}</td><td style="padding:8px;border-bottom:1px solid #eee">${l.delinquentDays} days</td></tr>`
      )
      .join("");
  }

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#C33732;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">StrongBox Report</h1>
        <p style="margin:4px 0 0;opacity:0.9;font-size:14px">${name} — ${new Date().toLocaleDateString()}</p>
      </div>
      <div style="padding:20px;border:1px solid #eee;border-top:0;border-radius:0 0 8px 8px">
        ${summary ? `<div style="display:flex;gap:16px;margin-bottom:20px">
          ${Object.entries(summary).map(([k, v]) => `<div style="flex:1;padding:12px;background:#F3F3F3;border-radius:6px"><div style="font-size:11px;color:#666;text-transform:uppercase">${k.replace(/([A-Z])/g, " $1").trim()}</div><div style="font-size:20px;font-weight:600;margin-top:4px">${typeof v === "number" && v > 1000 ? "$" + v.toLocaleString() : v}</div></div>`).join("")}
        </div>` : ""}
        ${rows ? `<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${rows}</tbody></table>` : `<pre style="font-size:12px;background:#f9f9f9;padding:12px;border-radius:4px;overflow:auto">${JSON.stringify(data, null, 2)}</pre>`}
      </div>
    </div>
  `;
}
