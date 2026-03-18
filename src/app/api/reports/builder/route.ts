import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

// POST /api/reports/builder — configurable report builder
export const POST = withAuth(async (request, ctx) => {
  const body = await request.json();
  const { entity, fields, filters, sortBy, sortDir, format: fmt } = body;

  const orgId = ctx.organizationId;

  if (!entity || !fields?.length) {
    return NextResponse.json({ error: "entity and fields are required" }, { status: 400 });
  }

  const validEntities = ["loans", "contacts", "payments", "properties", "documents"];
  if (!validEntities.includes(entity)) {
    return NextResponse.json({ error: `Invalid entity. Use: ${validEntities.join(", ")}` }, { status: 400 });
  }

  // Build where clause from filters
  const where: Record<string, unknown> = {};

  if (entity === "loans" || entity === "documents" || entity === "properties") {
    where.organizationId = orgId;
  }
  if (entity === "payments") {
    where.loan = { organizationId: orgId };
  }
  if (entity === "contacts") {
    where.organizationId = orgId;
  }

  // Apply user filters
  if (filters) {
    for (const filter of filters) {
      const { field, operator, value } = filter;
      switch (operator) {
        case "equals":
          where[field] = value;
          break;
        case "contains":
          where[field] = { contains: value, mode: "insensitive" };
          break;
        case "gt":
          where[field] = { gt: Number(value) };
          break;
        case "gte":
          where[field] = { gte: Number(value) };
          break;
        case "lt":
          where[field] = { lt: Number(value) };
          break;
        case "lte":
          where[field] = { lte: Number(value) };
          break;
        case "in":
          where[field] = { in: Array.isArray(value) ? value : value.split(",") };
          break;
        case "dateAfter":
          where[field] = { gte: new Date(value) };
          break;
        case "dateBefore":
          where[field] = { lte: new Date(value) };
          break;
      }
    }
  }

  // Build select from fields
  const select: Record<string, boolean | Record<string, boolean>> = {};
  const includeRelations: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.includes(".")) {
      const [relation, subfield] = field.split(".");
      if (!includeRelations[relation]) {
        includeRelations[relation] = { select: {} };
      }
      (includeRelations[relation] as any).select[subfield] = true;
    } else {
      select[field] = true;
    }
  }

  // Always include id
  select.id = true;

  const modelMap: Record<string, any> = {
    loans: prisma.loan,
    contacts: prisma.contact,
    payments: prisma.payment,
    properties: prisma.property,
    documents: prisma.document,
  };

  const model = modelMap[entity];
  if (!model) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }

  const queryArgs: Record<string, unknown> = {
    where: where as any,
    take: 500,
  };

  // Use select if no relations, include if relations needed
  if (Object.keys(includeRelations).length > 0) {
    queryArgs.include = includeRelations;
  } else {
    queryArgs.select = select;
  }

  if (sortBy) {
    queryArgs.orderBy = { [sortBy]: sortDir || "desc" };
  }

  const rows = await model.findMany(queryArgs);

  // CSV export
  if (fmt === "csv") {
    const flatFields = fields.map((f: string) => f.replace(".", "_"));
    const csvLines = [
      flatFields.join(","),
      ...rows.map((row: any) =>
        fields
          .map((field: string) => {
            let val: any;
            if (field.includes(".")) {
              const [rel, sub] = field.split(".");
              val = row[rel]?.[sub];
            } else {
              val = row[field];
            }
            if (val === null || val === undefined) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
          })
          .join(",")
      ),
    ];

    return new NextResponse(csvLines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${entity}-report.csv"`,
      },
    });
  }

  return NextResponse.json({ entity, rows, total: rows.length, fields });
}, "view_reports");

// GET /api/reports/builder — get available fields per entity
export const GET = withAuth(async (request, ctx) => {
  const entityFields: Record<string, { field: string; label: string; type: string }[]> = {
    loans: [
      { field: "loanNumber", label: "Loan Number", type: "string" },
      { field: "type", label: "Type", type: "enum" },
      { field: "status", label: "Status", type: "enum" },
      { field: "loanAmount", label: "Loan Amount", type: "number" },
      { field: "currentBalance", label: "Current Balance", type: "number" },
      { field: "interestRate", label: "Interest Rate", type: "number" },
      { field: "termMonths", label: "Term (months)", type: "number" },
      { field: "ltv", label: "LTV", type: "number" },
      { field: "daysDelinquent", label: "Days Delinquent", type: "number" },
      { field: "fundingDate", label: "Funding Date", type: "date" },
      { field: "maturityDate", label: "Maturity Date", type: "date" },
      { field: "applicationDate", label: "Application Date", type: "date" },
      { field: "totalInterestPaid", label: "Total Interest Paid", type: "number" },
      { field: "totalFeesPaid", label: "Total Fees Paid", type: "number" },
      { field: "borrower.firstName", label: "Borrower First Name", type: "string" },
      { field: "borrower.lastName", label: "Borrower Last Name", type: "string" },
      { field: "property.address", label: "Property Address", type: "string" },
      { field: "property.city", label: "Property City", type: "string" },
      { field: "property.state", label: "Property State", type: "string" },
    ],
    contacts: [
      { field: "firstName", label: "First Name", type: "string" },
      { field: "lastName", label: "Last Name", type: "string" },
      { field: "email", label: "Email", type: "string" },
      { field: "phone", label: "Phone", type: "string" },
      { field: "companyName", label: "Company", type: "string" },
      { field: "entityType", label: "Entity Type", type: "enum" },
      { field: "isBorrower", label: "Is Borrower", type: "boolean" },
      { field: "isInvestor", label: "Is Investor", type: "boolean" },
    ],
    payments: [
      { field: "amount", label: "Amount", type: "number" },
      { field: "principalAmount", label: "Principal", type: "number" },
      { field: "interestAmount", label: "Interest", type: "number" },
      { field: "status", label: "Status", type: "enum" },
      { field: "dueDate", label: "Due Date", type: "date" },
      { field: "paidDate", label: "Paid Date", type: "date" },
      { field: "paymentMethod", label: "Method", type: "string" },
      { field: "loan.loanNumber", label: "Loan Number", type: "string" },
    ],
    properties: [
      { field: "address", label: "Address", type: "string" },
      { field: "city", label: "City", type: "string" },
      { field: "state", label: "State", type: "string" },
      { field: "zip", label: "ZIP", type: "string" },
      { field: "county", label: "County", type: "string" },
      { field: "propertyType", label: "Type", type: "string" },
      { field: "purchasePrice", label: "Purchase Price", type: "number" },
      { field: "estimatedValue", label: "Estimated Value", type: "number" },
    ],
    documents: [
      { field: "fileName", label: "File Name", type: "string" },
      { field: "category", label: "Category", type: "enum" },
      { field: "fileSize", label: "File Size", type: "number" },
      { field: "isRequired", label: "Required", type: "boolean" },
      { field: "isReceived", label: "Received", type: "boolean" },
      { field: "createdAt", label: "Created", type: "date" },
      { field: "loan.loanNumber", label: "Loan Number", type: "string" },
    ],
  };

  return NextResponse.json({ entityFields });
}, "view_reports");
