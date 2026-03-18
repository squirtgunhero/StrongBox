import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

// POST /api/import — import data from CSV
export const POST = withAuth(async (request, ctx) => {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const importType = formData.get("type") as string;
  const dryRun = formData.get("dryRun") === "true";

  if (!file || !importType) {
    return NextResponse.json({ error: "file and type are required" }, { status: 400 });
  }

  const validTypes = ["loans", "contacts", "payments", "properties"];
  if (!validTypes.includes(importType)) {
    return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim()));

  const results = {
    total: dataRows.length,
    valid: 0,
    errors: [] as { row: number; field: string; message: string }[],
    created: 0,
    skipped: 0,
  };

  switch (importType) {
    case "contacts":
      await importContacts(headers, dataRows, ctx.organizationId, dryRun, results);
      break;
    case "loans":
      await importLoans(headers, dataRows, ctx.organizationId, ctx.user.id, dryRun, results);
      break;
    case "payments":
      await importPayments(headers, dataRows, ctx.organizationId, dryRun, results);
      break;
    case "properties":
      await importProperties(headers, dataRows, ctx.organizationId, dryRun, results);
      break;
  }

  return NextResponse.json({
    importType,
    dryRun,
    results,
    headers,
    sampleRows: dataRows.slice(0, 3).map((row) =>
      Object.fromEntries(headers.map((h, i) => [h, row[i] || ""]))
    ),
  });
}, "manage_org_settings");

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell);
        currentCell = "";
      } else if (char === "\n" || (char === "\r" && next === "\n")) {
        currentRow.push(currentCell);
        currentCell = "";
        rows.push(currentRow);
        currentRow = [];
        if (char === "\r") i++;
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function getField(headers: string[], row: string[], ...fieldNames: string[]): string {
  for (const name of fieldNames) {
    const idx = headers.indexOf(name.toLowerCase().replace(/\s+/g, "_"));
    if (idx >= 0 && row[idx]?.trim()) return row[idx].trim();
  }
  return "";
}

async function importContacts(
  headers: string[], rows: string[][], orgId: string, dryRun: boolean,
  results: { total: number; valid: number; errors: { row: number; field: string; message: string }[]; created: number; skipped: number }
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName = getField(headers, row, "first_name", "firstname", "first");
    const lastName = getField(headers, row, "last_name", "lastname", "last");
    const email = getField(headers, row, "email", "email_address");
    const phone = getField(headers, row, "phone", "phone_number", "mobile");

    if (!firstName && !lastName) {
      results.errors.push({ row: i + 2, field: "name", message: "Missing first or last name" });
      continue;
    }

    // Check for duplicate by email
    if (email) {
      const existing = await prisma.contact.findFirst({
        where: { organizationId: orgId, email },
      });
      if (existing) {
        results.skipped++;
        continue;
      }
    }

    results.valid++;
    if (!dryRun) {
      await prisma.contact.create({
        data: {
          organizationId: orgId,
          firstName: firstName || "",
          lastName: lastName || "",
          email: email || null,
          phone: phone || null,
          entityType: getField(headers, row, "type", "entity_type") || null,
          isBorrower: getField(headers, row, "is_borrower", "borrower").toLowerCase() === "true" || getField(headers, row, "is_borrower", "borrower") === "1",
          isInvestor: getField(headers, row, "is_investor", "investor").toLowerCase() === "true" || getField(headers, row, "is_investor", "investor") === "1",
        },
      });
      results.created++;
    }
  }
}

async function importLoans(
  headers: string[], rows: string[][], orgId: string, userId: string, dryRun: boolean,
  results: { total: number; valid: number; errors: { row: number; field: string; message: string }[]; created: number; skipped: number }
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const loanNumber = getField(headers, row, "loan_number", "loan_#", "loan_no");
    const borrowerName = getField(headers, row, "borrower", "borrower_name");
    const amountStr = getField(headers, row, "loan_amount", "amount", "principal");
    const rateStr = getField(headers, row, "interest_rate", "rate");
    const termStr = getField(headers, row, "term_months", "term");

    if (!loanNumber) {
      results.errors.push({ row: i + 2, field: "loan_number", message: "Missing loan number" });
      continue;
    }
    if (!amountStr) {
      results.errors.push({ row: i + 2, field: "loan_amount", message: "Missing loan amount" });
      continue;
    }

    const amount = parseFloat(amountStr.replace(/[$,]/g, ""));
    const rate = parseFloat(rateStr || "0");
    const term = parseInt(termStr || "12");

    if (isNaN(amount) || amount <= 0) {
      results.errors.push({ row: i + 2, field: "loan_amount", message: "Invalid loan amount" });
      continue;
    }

    // Check for duplicate
    const existing = await prisma.loan.findFirst({ where: { loanNumber } });
    if (existing) {
      results.skipped++;
      continue;
    }

    // Find or create borrower
    let borrowerId: string | null = null;
    if (borrowerName) {
      const parts = borrowerName.split(/[,\s]+/).filter(Boolean);
      const lastName = parts[0] || borrowerName;
      const firstName = parts[1] || "";
      let contact = await prisma.contact.findFirst({
        where: { organizationId: orgId, lastName, firstName },
      });
      if (!contact && !dryRun) {
        contact = await prisma.contact.create({
          data: { organizationId: orgId, firstName, lastName, isBorrower: true },
        });
      }
      borrowerId = contact?.id || null;
    }

    if (!borrowerId) {
      results.errors.push({ row: i + 2, field: "borrower", message: "Could not resolve borrower" });
      continue;
    }

    results.valid++;
    if (!dryRun) {
      await prisma.loan.create({
        data: {
          organizationId: orgId,
          loanNumber,
          borrowerId,
          type: (getField(headers, row, "type", "loan_type") as any) || "FIX_AND_FLIP",
          loanAmount: amount,
          interestRate: rate,
          termMonths: term,
          status: (getField(headers, row, "status") as any) || "ACTIVE",
          currentBalance: amount,
        },
      });
      results.created++;
    }
  }
}

async function importPayments(
  headers: string[], rows: string[][], orgId: string, dryRun: boolean,
  results: { total: number; valid: number; errors: { row: number; field: string; message: string }[]; created: number; skipped: number }
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const loanNumber = getField(headers, row, "loan_number", "loan_#", "loan_no");
    const amountStr = getField(headers, row, "amount", "payment_amount");
    const dueDateStr = getField(headers, row, "due_date", "date");
    const paidDateStr = getField(headers, row, "paid_date", "payment_date");

    if (!loanNumber || !amountStr) {
      results.errors.push({ row: i + 2, field: "loan_number/amount", message: "Missing required fields" });
      continue;
    }

    const loan = await prisma.loan.findFirst({ where: { loanNumber, organizationId: orgId } });
    if (!loan) {
      results.errors.push({ row: i + 2, field: "loan_number", message: `Loan ${loanNumber} not found` });
      continue;
    }

    const amount = parseFloat(amountStr.replace(/[$,]/g, ""));
    if (isNaN(amount)) {
      results.errors.push({ row: i + 2, field: "amount", message: "Invalid amount" });
      continue;
    }

    results.valid++;
    if (!dryRun) {
      const dueDate = dueDateStr ? new Date(dueDateStr) : new Date();
      const paidDate = paidDateStr ? new Date(paidDateStr) : null;
      await prisma.payment.create({
        data: {
          loanId: loan.id,
          amount,
          interestAmount: amount,
          principalAmount: 0,
          dueDate,
          paidDate,
          status: paidDate ? "PAID" : "SCHEDULED",
          paymentMethod: getField(headers, row, "method", "payment_method") || null,
        },
      });
      results.created++;
    }
  }
}

async function importProperties(
  headers: string[], rows: string[][], orgId: string, dryRun: boolean,
  results: { total: number; valid: number; errors: { row: number; field: string; message: string }[]; created: number; skipped: number }
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const address = getField(headers, row, "address", "street_address");
    const city = getField(headers, row, "city");
    const state = getField(headers, row, "state");
    const zip = getField(headers, row, "zip", "zip_code", "zipcode");

    if (!address || !city || !state || !zip) {
      results.errors.push({ row: i + 2, field: "address", message: "Missing address fields (address, city, state, zip)" });
      continue;
    }

    // Check duplicate
    const existing = await prisma.property.findFirst({
      where: { organizationId: orgId, address, city, state },
    });
    if (existing) {
      results.skipped++;
      continue;
    }

    results.valid++;
    if (!dryRun) {
      await prisma.property.create({
        data: {
          organizationId: orgId,
          address,
          city,
          state,
          zip,
          propertyType: (getField(headers, row, "property_type", "type") as any) || "SINGLE_FAMILY",
        },
      });
      results.created++;
    }
  }
}
