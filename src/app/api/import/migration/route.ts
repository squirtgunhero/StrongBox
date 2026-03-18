import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";

// POST /api/import/migration — specialized data migration for Strong Investor Loans sheets
export const POST = withAuth(async (request, ctx) => {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const sheetType = formData.get("sheetType") as string;
  const dryRun = formData.get("dryRun") === "true";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const validSheetTypes = [
    "cash_out",
    "exposure",
    "client_list",
    "tracy_stone_loan_summary",
    "available_cash",
  ];

  if (!validSheetTypes.includes(sheetType)) {
    return NextResponse.json(
      { error: `Invalid sheet type. Use: ${validSheetTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length < 2) {
    return NextResponse.json({ error: "File appears empty or has no data rows" }, { status: 400 });
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell.trim()));

  const results = {
    total: dataRows.length,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as { row: number; message: string }[],
  };

  const orgId = ctx.organizationId;

  for (let i = 0; i < dataRows.length; i++) {
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = dataRows[i][j]?.trim() || "";
    });

    try {
      switch (sheetType) {
        case "cash_out":
          await processCashOutRow(row, orgId, dryRun, results, i + 2);
          break;
        case "exposure":
          await processExposureRow(row, orgId, dryRun, results, i + 2);
          break;
        case "client_list":
          await processClientListRow(row, orgId, dryRun, results, i + 2);
          break;
        case "tracy_stone_loan_summary":
          await processTracyStoneSummaryRow(row, orgId, dryRun, results, i + 2);
          break;
        case "available_cash":
          await processAvailableCashRow(row, orgId, dryRun, results, i + 2);
          break;
      }
      results.processed++;
    } catch (err) {
      results.errors.push({ row: i + 2, message: String(err) });
    }
  }

  if (!dryRun) {
    await writeAuditLog({
      organizationId: orgId,
      action: "CREATE",
      entityType: "Import",
      entityId: sheetType,
      description: `Data migration: ${sheetType} — ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });
  }

  return NextResponse.json({
    sheetType,
    dryRun,
    results,
    headers,
    sampleRows: dataRows.slice(0, 3).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, j) => (obj[h] = r[j]?.trim() || ""));
      return obj;
    }),
  });
}, "manage_org_settings");

// Sheet-specific processors

async function processCashOutRow(
  row: Record<string, string>,
  orgId: string,
  dryRun: boolean,
  results: any,
  rowNum: number
) {
  // Cash Out sheet: loan payoffs and capital returns
  const loanNumber = row.loan_number || row["loan_#"] || row.loan;
  if (!loanNumber) {
    results.skipped++;
    return;
  }

  const loan = await prisma.loan.findFirst({
    where: { organizationId: orgId, loanNumber },
  });

  if (!loan) {
    results.errors.push({ row: rowNum, message: `Loan ${loanNumber} not found` });
    return;
  }

  if (!dryRun) {
    const payoffAmount = parseFloat(row.payoff_amount || row.amount || "0");
    const payoffDate = row.payoff_date || row.date;

    if (payoffAmount > 0 && payoffDate) {
      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          payoffDate: new Date(payoffDate),
          status: "PAID_OFF" as any,
        },
      });
      results.updated++;
    } else {
      results.skipped++;
    }
  } else {
    results.created++;
  }
}

async function processExposureRow(
  row: Record<string, string>,
  orgId: string,
  dryRun: boolean,
  results: any,
  rowNum: number
) {
  // Exposure sheet: investor capital allocations per loan
  const loanNumber = row.loan_number || row.loan;
  const investorName = row.investor || row.investor_name || row.source;
  const amount = parseFloat(row.amount || row.allocation || row.exposure || "0");

  if (!loanNumber || !investorName || !amount) {
    results.skipped++;
    return;
  }

  if (!dryRun) {
    const loan = await prisma.loan.findFirst({
      where: { organizationId: orgId, loanNumber },
    });
    if (!loan) {
      results.errors.push({ row: rowNum, message: `Loan ${loanNumber} not found` });
      return;
    }

    // Find or create capital source
    let source = await prisma.capitalSource.findFirst({
      where: { organizationId: orgId, name: investorName },
    });

    if (!source) {
      source = await prisma.capitalSource.create({
        data: {
          organizationId: orgId,
          name: investorName,
          type: "PRIVATE_INVESTOR",
          totalCommitted: amount,
          currentBalance: 0,
          isActive: true,
        },
      });
    }

    await prisma.capitalAllocation.create({
      data: {
        loanId: loan.id,
        capitalSourceId: source.id,
        amount,
        isActive: true,
      },
    });
    results.created++;
  } else {
    results.created++;
  }
}

async function processClientListRow(
  row: Record<string, string>,
  orgId: string,
  dryRun: boolean,
  results: any,
  rowNum: number
) {
  // Client list: borrowers/contacts
  const firstName = row.first_name || row.firstname || "";
  const lastName = row.last_name || row.lastname || row.name || "";
  const email = row.email || "";
  const phone = row.phone || row.cell || "";
  const company = row.company || row.company_name || row.entity || "";

  if (!firstName && !lastName && !company) {
    results.skipped++;
    return;
  }

  if (!dryRun) {
    // Check for existing
    const existing = await prisma.contact.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          email ? { email } : {},
          { firstName, lastName },
        ].filter((o) => Object.keys(o).length > 0),
      },
    });

    if (existing) {
      results.skipped++;
      return;
    }

    await prisma.contact.create({
      data: {
        organizationId: orgId,
        firstName: firstName || company.split(" ")[0] || "",
        lastName: lastName || company.split(" ").slice(1).join(" ") || "",
        email: email || null,
        phone: phone || null,
        companyName: company || null,
        entityType: company ? "LLC" : "INDIVIDUAL",
        isBorrower: true,
        isInvestor: false,
      },
    });
    results.created++;
  } else {
    results.created++;
  }
}

async function processTracyStoneSummaryRow(
  row: Record<string, string>,
  orgId: string,
  dryRun: boolean,
  results: any,
  rowNum: number
) {
  // Tracy Stone loan summary: loan details
  const loanNumber = row.loan_number || row.loan || row["loan_#"] || "";
  const borrowerName = row.borrower || row.borrower_name || "";
  const amount = parseFloat(row.loan_amount || row.amount || row.original_amount || "0");
  const rate = parseFloat(row.rate || row.interest_rate || "0");
  const term = parseInt(row.term || row.term_months || "12");

  if (!borrowerName && !loanNumber) {
    results.skipped++;
    return;
  }

  if (!dryRun) {
    // Check if loan already exists
    if (loanNumber) {
      const existing = await prisma.loan.findFirst({
        where: { organizationId: orgId, loanNumber },
      });
      if (existing) {
        // Update with additional data
        await prisma.loan.update({
          where: { id: existing.id },
          data: {
            ...(rate > 0 ? { interestRate: rate } : {}),
            ...(term > 0 ? { termMonths: term } : {}),
          },
        });
        results.updated++;
        return;
      }
    }
    results.skipped++; // Would need borrower matching for full creation
  } else {
    results.created++;
  }
}

async function processAvailableCashRow(
  row: Record<string, string>,
  orgId: string,
  dryRun: boolean,
  results: any,
  rowNum: number
) {
  // Available Cash sheet: capital source balances
  const sourceName = row.source || row.name || row.account || "";
  const balance = parseFloat(row.balance || row.available || row.amount || "0");
  const committed = parseFloat(row.committed || row.total || "0");

  if (!sourceName) {
    results.skipped++;
    return;
  }

  if (!dryRun) {
    const existing = await prisma.capitalSource.findFirst({
      where: { organizationId: orgId, name: sourceName },
    });

    if (existing) {
      await prisma.capitalSource.update({
        where: { id: existing.id },
        data: {
          currentBalance: balance,
          ...(committed > 0 ? { totalCommitted: committed } : {}),
        },
      });
      results.updated++;
    } else {
      await prisma.capitalSource.create({
        data: {
          organizationId: orgId,
          name: sourceName,
          type: "OPERATING_CAPITAL",
          totalCommitted: committed || balance,
          currentBalance: balance,
          isActive: true,
        },
      });
      results.created++;
    }
  } else {
    results.created++;
  }
}

// CSV parser
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      current.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      current.push(field);
      field = "";
      if (current.some((c) => c.trim())) rows.push(current);
      current = [];
    } else {
      field += ch;
    }
  }
  if (field || current.length) {
    current.push(field);
    if (current.some((c) => c.trim())) rows.push(current);
  }
  return rows;
}
