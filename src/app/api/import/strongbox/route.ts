import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { Prisma, SbDrawRequestStatus, SbImportStatus, SbLoanStage, SbLoanStatus } from "@prisma/client";
import {
  calculateLtv,
  calculatePrincipalTotal,
  calculateRehabRatio,
  calculateYearsOutstanding,
  getLoanStageFromSourceSheet,
} from "@/lib/strongbox/calculations";

type ValidationSeverity = "critical" | "warning";

type ValidationIssue = {
  code: string;
  field: string;
  message: string;
  severity: ValidationSeverity;
  reviewFlag: boolean;
  suggestedValue?: unknown;
  metadata?: Record<string, unknown>;
};

type ParsedRow = {
  sourceRowNumber: number;
  sourceRowKey: string;
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  issues: ValidationIssue[];
};

type CorrectionAuditEntry = {
  action: "corrected" | "published";
  appliedAt: string;
  appliedBy: string | null;
  note?: string | null;
  fields?: string[];
};

type CorrectionState = {
  values: Record<string, unknown>;
  history: CorrectionAuditEntry[];
};

type RemediationAuditChange = {
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
};

const SHEET_FAMILIES = [
  "open_applications",
  "upcoming_loans",
  "cash_out",
  "exposure",
  "draw_requests",
  "client_list",
  "closed_projects",
  "markets",
  "cash_accounts",
  "portfolio_snapshots",
  "tax_1098_prep",
] as const;

type SheetFamily = (typeof SHEET_FAMILIES)[number];

const LOAN_STATUSES = new Set([
  "pending",
  "approved",
  "funded",
  "active",
  "matured",
  "paid_off",
  "closed",
  "rejected",
  "on_hold",
]);

const DRAW_REQUEST_STATUSES = new Set(["requested", "under_review", "approved", "rejected", "funded"]);

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "active", "flagged"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "inactive", "clear", "ok"]);

const US_STATE_LOOKUP: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentCell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      currentRow.push(currentCell);
      currentCell = "";
      rows.push(currentRow);
      currentRow = [];
      if (char === "\r") index += 1;
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function parseJsonRows(text: string): { headers: string[]; rows: string[][] } {
  const parsed = JSON.parse(text) as Array<Record<string, unknown>>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = Array.from(
    parsed.reduce<Set<string>>((acc, row) => {
      Object.keys(row).forEach((key) => acc.add(canonicalHeader(key)));
      return acc;
    }, new Set<string>())
  );

  const rows = parsed.map((row) =>
    headers.map((header) => {
      const foundEntry = Object.entries(row).find(([key]) => canonicalHeader(key) === header);
      const value = foundEntry?.[1];
      return value == null ? "" : String(value);
    })
  );

  return { headers, rows };
}

function canonicalHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[canonicalHeader(key)] ?? row[key];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function normalizePlainText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeToken(value: string | null | undefined): string {
  return normalizePlainText(String(value || "")).toLowerCase();
}

function addIssue(
  issues: ValidationIssue[],
  issue: Omit<ValidationIssue, "reviewFlag"> & { reviewFlag?: boolean }
) {
  issues.push({
    reviewFlag: issue.reviewFlag ?? issue.severity === "warning",
    ...issue,
  });
}

function parseBoolean(value: string): boolean | null {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

function parseExcelDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const parsed = new Date(utcValue * 1000);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const fromExcel = parseExcelDate(Number(trimmed));
    if (fromExcel) return fromExcel;
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;

  const [, month, day, year] = match;
  const normalizedYear = year.length === 2 ? `20${year}` : year;
  const manual = new Date(Number(normalizedYear), Number(month) - 1, Number(day));
  return Number.isNaN(manual.getTime()) ? null : manual;
}

function toDate(value: string, field: string, issues: ValidationIssue[], required = false): Date | null {
  if (!value) {
    if (required) {
      addIssue(issues, {
        code: "missing_required",
        field,
        message: `${field} is required`,
        severity: "critical",
      });
    }
    return null;
  }

  const parsed = parseDateInput(value);
  if (!parsed) {
    addIssue(issues, {
      code: "invalid_date",
      field,
      message: `${field} could not be parsed as a date`,
      severity: "warning",
      suggestedValue: null,
    });
  }
  return parsed;
}

function toNumber(
  value: string,
  field: string,
  issues: ValidationIssue[],
  options?: { integer?: boolean; required?: boolean; allowNegative?: boolean }
): number | null {
  if (!value) {
    if (options?.required) {
      addIssue(issues, {
        code: "missing_required",
        field,
        message: `${field} is required`,
        severity: "critical",
      });
    }
    return null;
  }

  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  if (!Number.isFinite(parsed)) {
    addIssue(issues, {
      code: options?.integer ? "invalid_integer" : "invalid_currency",
      field,
      message: `${field} is not a valid ${options?.integer ? "number" : "currency value"}`,
      severity: "warning",
    });
    return null;
  }

  if (!options?.allowNegative && parsed < 0) {
    addIssue(issues, {
      code: "negative_not_allowed",
      field,
      message: `${field} cannot be negative`,
      severity: "warning",
    });
  }

  if (options?.integer && !Number.isInteger(parsed)) {
    addIssue(issues, {
      code: "invalid_integer",
      field,
      message: `${field} must be a whole number`,
      severity: "warning",
      suggestedValue: Math.round(parsed),
    });
  }

  return options?.integer ? Math.trunc(parsed) : parsed;
}

function normalizeState(value: string, field: string, issues: ValidationIssue[]): string | null {
  if (!value) return null;
  const trimmed = normalizePlainText(value);
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  const lookup = US_STATE_LOOKUP[trimmed.toLowerCase()];
  if (lookup) return lookup;

  addIssue(issues, {
    code: "invalid_state",
    field,
    message: `${field} is not a valid US state`,
    severity: "warning",
  });
  return null;
}

function parseAddress(fullAddress: string): { street: string | null; city: string | null; state: string | null; zip: string | null } {
  const address = normalizePlainText(fullAddress);
  if (!address) {
    return { street: null, city: null, state: null, zip: null };
  }

  const pieces = address.split(",").map((piece) => normalizePlainText(piece)).filter(Boolean);
  const street = pieces[0] || null;
  let city: string | null = null;
  let state: string | null = null;
  let zip: string | null = null;

  if (pieces.length >= 2) {
    const tail = pieces[pieces.length - 1];
    const stateZipMatch = tail.match(/([A-Za-z]{2}|[A-Za-z ]+)\s+(\d{5}(?:-\d{4})?)$/);
    if (stateZipMatch) {
      state = /^[A-Za-z]{2}$/.test(stateZipMatch[1]) ? stateZipMatch[1].toUpperCase() : US_STATE_LOOKUP[stateZipMatch[1].toLowerCase()] || null;
      zip = stateZipMatch[2];
      city = pieces[pieces.length - 2] || null;
    } else if (pieces.length >= 3) {
      city = pieces[pieces.length - 2] || null;
      const rawState = pieces[pieces.length - 1];
      state = /^[A-Za-z]{2}$/.test(rawState) ? rawState.toUpperCase() : US_STATE_LOOKUP[rawState.toLowerCase()] || null;
    }
  }

  if (!state) {
    const fallback = address.match(/,\s*([^,]+),\s*([A-Za-z]{2}|[A-Za-z ]+)\s+(\d{5}(?:-\d{4})?)$/);
    if (fallback) {
      city = normalizePlainText(fallback[1]);
      state = /^[A-Za-z]{2}$/.test(fallback[2]) ? fallback[2].toUpperCase() : US_STATE_LOOKUP[fallback[2].toLowerCase()] || null;
      zip = fallback[3];
    }
  }

  return { street, city, state, zip };
}

function normalizeLoanStatus(value: string, issues?: ValidationIssue[]): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return "pending";
  if (LOAN_STATUSES.has(normalized)) return normalized;
  if (issues) {
    addIssue(issues, {
      code: "invalid_status",
      field: "loan_status",
      message: `Loan status \"${value}\" is not recognized`,
      severity: "warning",
      suggestedValue: "pending",
    });
  }
  return "pending";
}

function normalizeDrawStatus(value: string, issues?: ValidationIssue[]): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return "requested";
  if (DRAW_REQUEST_STATUSES.has(normalized)) return normalized;
  if (issues) {
    addIssue(issues, {
      code: "invalid_status",
      field: "status",
      message: `Draw status \"${value}\" is not recognized`,
      severity: "warning",
      suggestedValue: "requested",
    });
  }
  return "requested";
}

function toSbLoanStage(value: unknown): SbLoanStage {
  switch (String(value || "application").trim().toLowerCase()) {
    case "upcoming":
      return SbLoanStage.UPCOMING;
    case "active":
      return SbLoanStage.ACTIVE;
    case "closed":
      return SbLoanStage.CLOSED;
    default:
      return SbLoanStage.APPLICATION;
  }
}

function toSbLoanStatus(value: unknown): SbLoanStatus {
  switch (String(value || "pending").trim().toLowerCase()) {
    case "approved":
      return SbLoanStatus.APPROVED;
    case "funded":
      return SbLoanStatus.FUNDED;
    case "active":
      return SbLoanStatus.ACTIVE;
    case "matured":
      return SbLoanStatus.MATURED;
    case "paid_off":
      return SbLoanStatus.PAID_OFF;
    case "closed":
      return SbLoanStatus.CLOSED;
    case "rejected":
      return SbLoanStatus.REJECTED;
    case "on_hold":
      return SbLoanStatus.ON_HOLD;
    default:
      return SbLoanStatus.PENDING;
  }
}

function toSbDrawRequestStatus(value: unknown): SbDrawRequestStatus {
  switch (String(value || "requested").trim().toLowerCase()) {
    case "under_review":
      return SbDrawRequestStatus.UNDER_REVIEW;
    case "approved":
      return SbDrawRequestStatus.APPROVED;
    case "rejected":
      return SbDrawRequestStatus.REJECTED;
    case "funded":
      return SbDrawRequestStatus.FUNDED;
    default:
      return SbDrawRequestStatus.REQUESTED;
  }
}

function detectSheetFamily(value: string): SheetFamily | null {
  const normalized = canonicalHeader(value);

  if (normalized.startsWith("closed_projects")) {
    return "closed_projects";
  }
  if (["active_markets", "future_cities", "expansion_cities"].includes(normalized)) {
    return "markets";
  }

  if (SHEET_FAMILIES.includes(normalized as SheetFamily)) {
    return normalized as SheetFamily;
  }
  return null;
}

function getAuditEntityType(family: SheetFamily | string): string {
  switch (family) {
    case "open_applications":
    case "upcoming_loans":
    case "cash_out":
    case "exposure":
    case "closed_projects":
      return "loans";
    case "draw_requests":
      return "draw_requests";
    case "client_list":
      return "borrowers";
    case "markets":
      return "market_references";
    case "cash_accounts":
      return "cash_accounts";
    case "portfolio_snapshots":
      return "portfolio_snapshots";
    case "tax_1098_prep":
      return "tax_1098_prep";
    default:
      return canonicalHeader(String(family || "import_rows")) || "import_rows";
  }
}

function isPublishableRowStatus(status: string) {
  return ["VALID", "CORRECTED", "PUBLISHED"].includes(status);
}

async function matchMarketName(
  marketReferences: Array<{ market_name: string; state: string | null }>,
  explicitMarketName: string,
  city: string | null,
  state: string | null
): Promise<string | null> {
  const candidates = [explicitMarketName, city ?? ""]
    .map((value) => normalizeToken(value))
    .filter(Boolean);

  if (candidates.length === 0) return null;

  const matching = marketReferences.find((market) => {
    const marketName = normalizeToken(market.market_name);
    const sameState = !state || !market.state || market.state === state;
    return sameState && candidates.includes(marketName);
  });

  return matching?.market_name ?? null;
}

function getCorrectionState(value: Prisma.JsonValue | null | undefined): CorrectionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { values: {}, history: [] };
  }

  const raw = value as Record<string, unknown>;
  const maybeHistory = Array.isArray(raw.history) ? (raw.history as CorrectionAuditEntry[]) : [];
  const maybeValues = raw.values && typeof raw.values === "object" && !Array.isArray(raw.values)
    ? (raw.values as Record<string, unknown>)
    : (raw as Record<string, unknown>);

  return {
    values: maybeValues,
    history: maybeHistory,
  };
}

function buildCorrectionState(
  existing: Prisma.JsonValue | null | undefined,
  values: Record<string, unknown>,
  actorId: string | null,
  note?: string | null,
  action: CorrectionAuditEntry["action"] = "corrected"
): CorrectionState {
  const current = getCorrectionState(existing);
  const mergedValues = { ...current.values, ...values };

  return {
    values: mergedValues,
    history: [
      ...current.history,
      {
        action,
        appliedAt: new Date().toISOString(),
        appliedBy: actorId,
        note: note ?? null,
        fields: Object.keys(values),
      },
    ],
  };
}

function getMergedPayload(row: { normalized_payload: Prisma.JsonValue | null; admin_correction: Prisma.JsonValue | null }): Record<string, unknown> {
  const normalizedPayload = (row.normalized_payload as Record<string, unknown>) || {};
  const correctionState = getCorrectionState(row.admin_correction);
  return {
    ...normalizedPayload,
    ...correctionState.values,
  };
}

function toAuditJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function valuesMatch(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

async function recordRemediationAudit(
  rowId: string,
  entityType: string,
  actionType: string,
  changes: RemediationAuditChange[],
  actorId: string | null,
  note?: string | null
) {
  if (changes.length === 0 && !note) return;

  const entries = changes.length > 0
    ? changes
    : [{ fieldName: null, oldValue: null, newValue: null }];

  await prisma.$transaction(
    entries.map((change) =>
      prisma.sbRemediationAudit.create({
        data: {
          import_row_id: rowId,
          entity_type: entityType,
          action_type: actionType,
          field_name: change.fieldName,
          old_value: toAuditJsonValue(change.oldValue),
          new_value: toAuditJsonValue(change.newValue),
          actor_id: actorId,
          note: note ?? null,
        },
      })
    )
  );
}

async function upsertBorrower(legalName: string, contactName?: string | null, email?: string | null, phone?: string | null) {
  const borrowerOr: Prisma.SbBorrowerWhereInput[] = [{ legal_name: legalName }];
  if (email) borrowerOr.push({ email });

  const existing = await prisma.sbBorrower.findFirst({
    where: { OR: borrowerOr },
  });

  if (existing) {
    return prisma.sbBorrower.update({
      where: { id: existing.id },
      data: {
        contact_name: contactName || existing.contact_name,
        email: email || existing.email,
        phone: phone || existing.phone,
      },
    });
  }

  return prisma.sbBorrower.create({
    data: {
      legal_name: legalName,
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
      active_flag: true,
    },
  });
}

async function upsertProperty(payload: Record<string, unknown>, borrowerId: string) {
  const fullAddress = String(payload.full_address || "");

  const existing = await prisma.sbProperty.findFirst({
    where: {
      full_address: fullAddress,
      borrower_id: borrowerId,
    },
  });

  if (existing) {
    return prisma.sbProperty.update({
      where: { id: existing.id },
      data: {
        city: (payload.city as string | null) ?? existing.city,
        state: (payload.state as string | null) ?? existing.state,
        zip: (payload.zip as string | null) ?? existing.zip,
        market_name: (payload.market_name as string | null) ?? existing.market_name,
      },
    });
  }

  return prisma.sbProperty.create({
    data: {
      borrower_id: borrowerId,
      full_address: fullAddress,
      city: (payload.city as string | null) ?? null,
      state: (payload.state as string | null) ?? null,
      zip: (payload.zip as string | null) ?? null,
      market_name: (payload.market_name as string | null) ?? "Unmapped",
      is_active: true,
    },
  });
}

async function validateAndNormalizeRow(
  family: SheetFamily,
  sourceSheetName: string,
  row: Record<string, string>,
  sourceRowNumber: number,
  marketReferences: Array<{ market_name: string; state: string | null }>
): Promise<ParsedRow> {
  const issues: ValidationIssue[] = [];
  const sourceRowKey = pick(row, "source_row_key") || `${canonicalHeader(sourceSheetName)}:${sourceRowNumber}`;

  const normalized: Record<string, unknown> = {
    source_sheet: sourceSheetName,
    source_row_key: sourceRowKey,
  };

  if (family === "client_list") {
    const legalName = pick(row, "legal_name", "borrower", "borrower_name", "company", "name");
    const contactName = pick(row, "contact_name", "contact");
    const email = pick(row, "email");
    const phone = pick(row, "phone", "mobile");

    if (!legalName && !contactName) {
      addIssue(issues, {
        code: "missing_required",
        field: "legal_name",
        message: "Borrower legal name or contact name is required",
        severity: "critical",
      });
    }

    normalized.legal_name = legalName || contactName;
    normalized.contact_name = contactName || null;
    normalized.email = email || null;
    normalized.phone = phone || null;
    normalized.ein = pick(row, "ein", "tax_id") || null;
    normalized.mailing_address = pick(row, "mailing_address", "address") || null;
    normalized.source = pick(row, "source") || null;
    normalized.home_state = normalizeState(pick(row, "home_state", "state"), "home_state", issues);
    normalized.notes = pick(row, "notes") || null;
  }

  if (["open_applications", "upcoming_loans", "cash_out", "exposure", "closed_projects"].includes(family)) {
    const borrowerName = pick(row, "borrower", "borrower_name", "legal_name");
    const fullAddress = pick(row, "full_address", "property_address", "address");
    const addressParts = parseAddress(fullAddress);
    const explicitCity = pick(row, "city");
    const explicitState = pick(row, "state");
    const explicitZip = pick(row, "zip", "zipcode");
    const normalizedState = normalizeState(explicitState || addressParts.state || "", "state", issues);
    const city = explicitCity || addressParts.city;
    const zip = explicitZip || addressParts.zip;
    const explicitMarketName = pick(row, "market_name", "market");
    const matchedMarketName = await matchMarketName(marketReferences, explicitMarketName, city, normalizedState);

    const purchaseAmount = toNumber(pick(row, "purchase_amount", "purchase"), "purchase_amount", issues);
    const rehabAmount = toNumber(pick(row, "rehab_amount", "rehab"), "rehab_amount", issues);
    const sourcePrincipal = toNumber(pick(row, "principal_total", "loan_amount", "principal"), "principal_total", issues);
    const arv = toNumber(pick(row, "arv"), "arv", issues);

    const principalTotal = calculatePrincipalTotal(purchaseAmount, rehabAmount, sourcePrincipal);
    const ltv = calculateLtv(principalTotal, arv);
    const rehabPercent = calculateRehabRatio(rehabAmount, principalTotal);
    const loanStage = family === "closed_projects" ? "closed" : getLoanStageFromSourceSheet(sourceSheetName);
    const loanStatus = normalizeLoanStatus(pick(row, "loan_status", "status") || (family === "closed_projects" ? "closed" : "pending"), issues);
    const originationDate = toDate(pick(row, "origination_date", "funding_date"), "origination_date", issues);
    const payoffDate = toDate(pick(row, "payoff_date"), "payoff_date", issues);
    const maturityDate = toDate(pick(row, "maturity_date"), "maturity_date", issues);

    if (!borrowerName) {
      addIssue(issues, {
        code: "missing_required",
        field: "borrower_name",
        message: "Borrower name is required",
        severity: "critical",
      });
    }
    if (!fullAddress) {
      addIssue(issues, {
        code: "missing_required",
        field: "full_address",
        message: "Property address is required",
        severity: "critical",
      });
    }
    if (fullAddress && (!city || !normalizedState)) {
      addIssue(issues, {
        code: "invalid_address",
        field: "full_address",
        message: "Address could not be fully parsed into city and state",
        severity: "warning",
      });
    }
    if (principalTotal == null) {
      addIssue(issues, {
        code: "missing_required",
        field: "principal_total",
        message: "Principal is missing and could not be inferred",
        severity: "critical",
      });
    }
    if (arv == null || arv === 0) {
      addIssue(issues, {
        code: "missing_arv",
        field: "arv",
        message: "Missing ARV",
        severity: "warning",
      });
    }
    if (ltv != null && ltv > 0.75) {
      addIssue(issues, {
        code: "high_ltv",
        field: "ltv",
        message: "Loan-to-value exceeds the 75% review threshold",
        severity: "warning",
        metadata: { threshold: 0.75, actual: ltv },
      });
    }
    if (loanStage === "active" && maturityDate && maturityDate.getTime() < Date.now() && !payoffDate) {
      addIssue(issues, {
        code: "matured_unpaid",
        field: "maturity_date",
        message: "Loan is matured and unpaid",
        severity: "warning",
      });
    }
    if (!matchedMarketName) {
      addIssue(issues, {
        code: "unmapped_market",
        field: "market_name",
        message: "Property market could not be matched to market_reference",
        severity: "warning",
        suggestedValue: city || null,
        metadata: { city, state: normalizedState },
      });
    }

    normalized.borrower_name = borrowerName;
    normalized.full_address = fullAddress;
    normalized.city = city || null;
    normalized.state = normalizedState;
    normalized.zip = zip || null;
    normalized.market_name = matchedMarketName || "Unmapped";
    normalized.loan_stage = loanStage;
    normalized.loan_status = loanStatus;
    normalized.loan_type = pick(row, "loan_type", "type") || null;
    normalized.origination_date = originationDate;
    normalized.payoff_date = payoffDate;
    normalized.maturity_date = maturityDate;
    normalized.term_months = toNumber(pick(row, "term_months", "term"), "term_months", issues, { integer: true });
    normalized.terms_text = pick(row, "terms_text", "terms") || null;
    normalized.purchase_amount = purchaseAmount;
    normalized.rehab_amount = rehabAmount;
    normalized.principal_total = principalTotal;
    normalized.draw_reserve = toNumber(pick(row, "draw_reserve"), "draw_reserve", issues);
    normalized.arv = arv;
    normalized.ltv = ltv;
    normalized.rehab_percent_of_loan = rehabPercent;
    normalized.interest_rate = toNumber(pick(row, "interest_rate", "rate"), "interest_rate", issues);
    normalized.origination_fee = toNumber(pick(row, "origination_fee"), "origination_fee", issues);
    normalized.uw_fee = toNumber(pick(row, "uw_fee", "underwriting_fee"), "uw_fee", issues);
    normalized.rush_fee = toNumber(pick(row, "rush_fee"), "rush_fee", issues);
    normalized.upfront_cash_required = toNumber(pick(row, "upfront_cash_required", "cash_needed_now"), "upfront_cash_required", issues);
    normalized.monthly_payment = toNumber(pick(row, "monthly_payment"), "monthly_payment", issues);
    normalized.total_cash_currently_needed = toNumber(pick(row, "total_cash_currently_needed", "cash_needed_now"), "total_cash_currently_needed", issues);
    normalized.calculation_notes = sourcePrincipal == null && principalTotal != null
      ? "principal_total inferred from purchase_amount + rehab_amount"
      : null;
    normalized.accrued_interest_mode = pick(row, "accrued_interest_mode") || null;
    normalized.title_company = pick(row, "title_company") || null;
    normalized.title_contact = pick(row, "title_contact") || null;
    normalized.notes = pick(row, "notes") || null;

    if (loanStage === "upcoming" && !normalized.title_company) {
      addIssue(issues, {
        code: "missing_title_company",
        field: "title_company",
        message: "Upcoming loan is missing title company",
        severity: "warning",
      });
    }
  }

  if (family === "draw_requests") {
    const loanSourceKey = pick(row, "loan_source_row_key", "loan_key", "source_row_key", "loan_number");
    const amountRequested = toNumber(pick(row, "amount_requested", "draw_amount", "amount"), "amount_requested", issues, { required: true });
    const requestDate = toDate(pick(row, "request_date", "date"), "request_date", issues);
    const approvedAmount = toNumber(pick(row, "approved_amount"), "approved_amount", issues);
    const drawStatus = normalizeDrawStatus(pick(row, "status") || "requested", issues);

    if (!loanSourceKey) {
      addIssue(issues, {
        code: "broken_loan_reference",
        field: "loan_source_row_key",
        message: "Loan reference is required",
        severity: "critical",
      });
    }

    let remainingRehab: number | null = null;
    if (loanSourceKey) {
      const loan = await prisma.sbLoan.findFirst({
        where: {
          OR: [{ source_row_key: loanSourceKey }, { id: loanSourceKey }],
        },
      });

      if (!loan) {
        addIssue(issues, {
          code: "broken_loan_reference",
          field: "loan_source_row_key",
          message: "Loan reference does not match an imported StrongBox loan",
          severity: "critical",
        });
      } else if (amountRequested != null) {
        const approvedDrawsAgg = await prisma.sbDrawRequest.aggregate({
          where: {
            loan_id: loan.id,
            status: { in: ["APPROVED", "FUNDED"] },
          },
          _sum: { approved_amount: true },
        });

        remainingRehab = Number(loan.rehab_amount || 0) - Number(approvedDrawsAgg._sum.approved_amount || 0);
        if (amountRequested > remainingRehab) {
          addIssue(issues, {
            code: "exceeded_draw_limits",
            field: "amount_requested",
            message: "Draw request exceeds remaining rehab funds",
            severity: "warning",
            metadata: { remainingRehab, requested: amountRequested },
          });
        }
      }
    }

    normalized.loan_source_key = loanSourceKey;
    normalized.request_date = requestDate;
    normalized.amount_requested = amountRequested;
    normalized.payment_method = pick(row, "payment_method") || null;
    normalized.status = drawStatus;
    normalized.notes = pick(row, "notes") || null;
    normalized.approved_amount = approvedAmount;
    normalized.processed_date = toDate(pick(row, "processed_date", "funded_date"), "processed_date", issues);
    normalized.remaining_rehab_capacity = remainingRehab;
  }

  if (family === "markets") {
    const marketName = pick(row, "market_name", "city", "market");
    const state = normalizeState(pick(row, "state"), "state", issues);

    if (!marketName) {
      addIssue(issues, {
        code: "missing_required",
        field: "market_name",
        message: "Market name is required",
        severity: "critical",
      });
    }

    normalized.market_name = marketName;
    normalized.state = state;
    normalized.is_active = parseBoolean(pick(row, "is_active", "active")) ?? true;
    normalized.is_future_market = parseBoolean(pick(row, "is_future_market", "future")) ?? false;
    normalized.is_expansion_market = parseBoolean(pick(row, "is_expansion_market", "expansion")) ?? false;
  }

  if (family === "cash_accounts") {
    const accountName = pick(row, "account_name", "account", "bank_account", "name");
    const currentBalance = toNumber(pick(row, "current_balance", "balance"), "current_balance", issues, { required: true });
    const updatedOn = toDate(pick(row, "updated_on", "as_of_date", "date"), "updated_on", issues, true);

    if (!accountName) {
      addIssue(issues, {
        code: "missing_required",
        field: "account_name",
        message: "Account name is required",
        severity: "critical",
      });
    }

    normalized.account_name = accountName;
    normalized.current_balance = currentBalance;
    normalized.updated_on = updatedOn;
    normalized.notes = pick(row, "notes") || null;
  }

  if (family === "portfolio_snapshots") {
    const snapshotDate = toDate(pick(row, "snapshot_date", "as_of_date", "date"), "snapshot_date", issues, true);
    normalized.snapshot_date = snapshotDate;
    normalized.total_loans_out = toNumber(pick(row, "total_loans_out", "loans_out"), "total_loans_out", issues);
    normalized.total_company_cash = toNumber(pick(row, "total_company_cash", "company_cash_total"), "total_company_cash", issues);
    normalized.company_cash_out = toNumber(pick(row, "company_cash_out"), "company_cash_out", issues);
    normalized.total_draw_reserve = toNumber(pick(row, "total_draw_reserve", "draw_reserve"), "total_draw_reserve", issues);
    normalized.upcoming_hml_loans = toNumber(pick(row, "upcoming_hml_loans", "upcoming_loans"), "upcoming_hml_loans", issues, { integer: true });
    normalized.loc_business_balance = toNumber(pick(row, "loc_business_balance", "loc_balance"), "loc_business_balance", issues);
    normalized.current_cash_balance = toNumber(pick(row, "current_cash_balance", "current_cash"), "current_cash_balance", issues);
  }

  if (family === "tax_1098_prep") {
    const borrowerName = pick(row, "borrower_name", "borrower", "legal_name");
    const sourceReference = pick(row, "source_reference", "loan_source_row_key", "loan_key") || sourceRowKey;
    const propertyAddress = pick(row, "property_address", "address");
    const reviewFlag = parseBoolean(pick(row, "review_flag")) ?? false;

    if (!borrowerName) {
      addIssue(issues, {
        code: "missing_required",
        field: "borrower_name",
        message: "Borrower name is required",
        severity: "critical",
      });
    }

    const borrower = borrowerName
      ? await prisma.sbBorrower.findFirst({ where: { legal_name: borrowerName } })
      : null;
    const referencedLoan = sourceReference
      ? await prisma.sbLoan.findFirst({
          where: {
            OR: [{ source_row_key: sourceReference }, { id: sourceReference }],
          },
        })
      : null;

    if (!borrower && !referencedLoan) {
      addIssue(issues, {
        code: "broken_tax_prep_reference",
        field: "source_reference",
        message: "Tax prep row does not match an imported borrower or loan reference",
        severity: "warning",
      });
    }

    normalized.borrower_name = borrowerName;
    normalized.borrower_id = borrower?.id ?? null;
    normalized.loans_closed_2022_count = toNumber(pick(row, "loans_closed_2022_count", "closed_2022"), "loans_closed_2022_count", issues, { integer: true }) ?? 0;
    normalized.loans_closed_2023_count = toNumber(pick(row, "loans_closed_2023_count", "closed_2023"), "loans_closed_2023_count", issues, { integer: true }) ?? 0;
    normalized.active_or_cashout_count = toNumber(pick(row, "active_or_cashout_count", "active_count"), "active_or_cashout_count", issues, { integer: true }) ?? 0;
    normalized.total_loan_count = toNumber(pick(row, "total_loan_count", "loan_count"), "total_loan_count", issues, { integer: true }) ?? 0;
    normalized.terms_reference = pick(row, "terms_reference", "terms") || null;
    normalized.property_address = propertyAddress || null;
    normalized.notes = pick(row, "notes") || null;
    normalized.source_reference = sourceReference;
    normalized.review_flag = reviewFlag || issues.some((issue) => issue.code === "broken_tax_prep_reference");
  }

  const closedYear = toNumber(pick(row, "closed_year", "year"), "closed_year", issues, { integer: true });
  if (family === "closed_projects") {
    normalized.closed_year = closedYear;
    if (closedYear == null) {
      addIssue(issues, {
        code: "missing_required",
        field: "closed_year",
        message: "Closed year is required for closed projects",
        severity: "critical",
      });
    }

    normalized.years_outstanding = calculateYearsOutstanding(
      normalized.origination_date as Date | null,
      normalized.payoff_date as Date | null
    );
  }

  return {
    sourceRowNumber,
    sourceRowKey,
    raw: row,
    normalized,
    issues,
  };
}

async function publishRow(
  family: SheetFamily,
  sourceSheetName: string,
  sourceRowKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (family === "client_list") {
    await upsertBorrower(
      String(payload.legal_name || ""),
      (payload.contact_name as string | null) ?? null,
      (payload.email as string | null) ?? null,
      (payload.phone as string | null) ?? null
    );
    return;
  }

  if (["open_applications", "upcoming_loans", "cash_out", "exposure", "closed_projects"].includes(family)) {
    const borrowerName = String(payload.borrower_name || "");
    const borrower = await upsertBorrower(borrowerName);
    const property = await upsertProperty(payload, borrower.id);

    const loan = await prisma.sbLoan.upsert({
      where: {
        source_sheet_source_row_key: {
          source_sheet: sourceSheetName,
          source_row_key: sourceRowKey,
        },
      },
      update: {
        borrower_id: borrower.id,
        property_id: property.id,
        loan_stage: toSbLoanStage(payload.loan_stage),
        loan_status: toSbLoanStatus(payload.loan_status),
        loan_type: (payload.loan_type as string | null) ?? null,
        origination_date: (payload.origination_date as Date | null) ?? null,
        payoff_date: (payload.payoff_date as Date | null) ?? null,
        maturity_date: (payload.maturity_date as Date | null) ?? null,
        term_months: (payload.term_months as number | null) ?? null,
        terms_text: (payload.terms_text as string | null) ?? null,
        principal_total: (payload.principal_total as number | null) ?? null,
        purchase_amount: (payload.purchase_amount as number | null) ?? null,
        rehab_amount: (payload.rehab_amount as number | null) ?? null,
        draw_reserve: (payload.draw_reserve as number | null) ?? null,
        arv: (payload.arv as number | null) ?? null,
        ltv: (payload.ltv as number | null) ?? null,
        rehab_percent_of_loan: (payload.rehab_percent_of_loan as number | null) ?? null,
        interest_rate: (payload.interest_rate as number | null) ?? null,
        origination_fee: (payload.origination_fee as number | null) ?? null,
        uw_fee: (payload.uw_fee as number | null) ?? null,
        rush_fee: (payload.rush_fee as number | null) ?? null,
        upfront_cash_required: (payload.upfront_cash_required as number | null) ?? null,
        monthly_payment: (payload.monthly_payment as number | null) ?? null,
        total_cash_currently_needed: (payload.total_cash_currently_needed as number | null) ?? null,
        calculation_notes: (payload.calculation_notes as string | null) ?? null,
        accrued_interest_mode: (payload.accrued_interest_mode as string | null) ?? null,
        title_company: (payload.title_company as string | null) ?? null,
        title_contact: (payload.title_contact as string | null) ?? null,
        notes: (payload.notes as string | null) ?? null,
      },
      create: {
        borrower_id: borrower.id,
        property_id: property.id,
        loan_stage: toSbLoanStage(payload.loan_stage),
        loan_status: toSbLoanStatus(payload.loan_status),
        loan_type: (payload.loan_type as string | null) ?? null,
        origination_date: (payload.origination_date as Date | null) ?? null,
        payoff_date: (payload.payoff_date as Date | null) ?? null,
        maturity_date: (payload.maturity_date as Date | null) ?? null,
        term_months: (payload.term_months as number | null) ?? null,
        terms_text: (payload.terms_text as string | null) ?? null,
        principal_total: (payload.principal_total as number | null) ?? null,
        purchase_amount: (payload.purchase_amount as number | null) ?? null,
        rehab_amount: (payload.rehab_amount as number | null) ?? null,
        draw_reserve: (payload.draw_reserve as number | null) ?? null,
        arv: (payload.arv as number | null) ?? null,
        ltv: (payload.ltv as number | null) ?? null,
        rehab_percent_of_loan: (payload.rehab_percent_of_loan as number | null) ?? null,
        interest_rate: (payload.interest_rate as number | null) ?? null,
        origination_fee: (payload.origination_fee as number | null) ?? null,
        uw_fee: (payload.uw_fee as number | null) ?? null,
        rush_fee: (payload.rush_fee as number | null) ?? null,
        upfront_cash_required: (payload.upfront_cash_required as number | null) ?? null,
        monthly_payment: (payload.monthly_payment as number | null) ?? null,
        total_cash_currently_needed: (payload.total_cash_currently_needed as number | null) ?? null,
        calculation_notes: (payload.calculation_notes as string | null) ?? null,
        accrued_interest_mode: (payload.accrued_interest_mode as string | null) ?? null,
        title_company: (payload.title_company as string | null) ?? null,
        title_contact: (payload.title_contact as string | null) ?? null,
        notes: (payload.notes as string | null) ?? null,
        source_sheet: sourceSheetName,
        source_row_key: sourceRowKey,
      },
    });

    if (family === "closed_projects" && payload.closed_year) {
      await prisma.sbAnnualLoanHistory.upsert({
        where: { id: `${loan.id}:${payload.closed_year as number}` },
        update: {
          closed_year: Number(payload.closed_year),
          borrower_name: borrower.legal_name,
          origination_date: (payload.origination_date as Date | null) ?? null,
          payoff_date: (payload.payoff_date as Date | null) ?? null,
          years_outstanding: (payload.years_outstanding as number | null) ?? null,
          principal: (payload.principal_total as number | null) ?? null,
          purchase_amount: (payload.purchase_amount as number | null) ?? null,
          rehab_amount: (payload.rehab_amount as number | null) ?? null,
          city: (payload.city as string | null) ?? null,
          state: (payload.state as string | null) ?? null,
          loan_type: (payload.loan_type as string | null) ?? null,
          terms_text: (payload.terms_text as string | null) ?? null,
          property_address: (payload.full_address as string | null) ?? null,
        },
        create: {
          id: `${loan.id}:${payload.closed_year as number}`,
          loan_id: loan.id,
          closed_year: Number(payload.closed_year),
          borrower_name: borrower.legal_name,
          origination_date: (payload.origination_date as Date | null) ?? null,
          payoff_date: (payload.payoff_date as Date | null) ?? null,
          years_outstanding: (payload.years_outstanding as number | null) ?? null,
          principal: (payload.principal_total as number | null) ?? null,
          purchase_amount: (payload.purchase_amount as number | null) ?? null,
          rehab_amount: (payload.rehab_amount as number | null) ?? null,
          city: (payload.city as string | null) ?? null,
          state: (payload.state as string | null) ?? null,
          loan_type: (payload.loan_type as string | null) ?? null,
          terms_text: (payload.terms_text as string | null) ?? null,
          property_address: (payload.full_address as string | null) ?? null,
        },
      });
    }

    return;
  }

  if (family === "draw_requests") {
    const loanSourceKey = String(payload.loan_source_key || "");
    const loan = await prisma.sbLoan.findFirst({
      where: {
        OR: [{ source_row_key: loanSourceKey }, { id: loanSourceKey }],
      },
    });

    if (!loan) return;

    const approvedDrawsAgg = await prisma.sbDrawRequest.aggregate({
      where: {
        loan_id: loan.id,
        status: { in: ["APPROVED", "FUNDED"] },
      },
      _sum: { approved_amount: true },
    });

    const approvedTotal = Number(approvedDrawsAgg._sum.approved_amount || 0);
    const rehab = Number(loan.rehab_amount || 0);
    const remaining = rehab - approvedTotal;
    const requested = Number(payload.amount_requested || 0);
    const exceeds = requested > remaining;

    const existing = await prisma.sbDrawRequest.findFirst({
      where: {
        loan_id: loan.id,
        request_date: (payload.request_date as Date | null) ?? undefined,
        amount_requested: requested,
      },
    });

    const draw = existing
      ? await prisma.sbDrawRequest.update({
          where: { id: existing.id },
          data: {
            property_id: loan.property_id,
            payment_method: (payload.payment_method as string | null) ?? null,
            status: toSbDrawRequestStatus(payload.status),
            notes: (payload.notes as string | null) ?? null,
            approved_amount: (payload.approved_amount as number | null) ?? null,
            processed_date: (payload.processed_date as Date | null) ?? null,
            exception_flag: exceeds,
          },
        })
      : await prisma.sbDrawRequest.create({
          data: {
            loan_id: loan.id,
            property_id: loan.property_id,
            request_date: (payload.request_date as Date | null) ?? new Date(),
            amount_requested: requested,
            payment_method: (payload.payment_method as string | null) ?? null,
            status: toSbDrawRequestStatus(payload.status),
            notes: (payload.notes as string | null) ?? null,
            approved_amount: (payload.approved_amount as number | null) ?? null,
            processed_date: (payload.processed_date as Date | null) ?? null,
            exception_flag: exceeds,
          },
        });

    await prisma.sbDrawRequestAudit.create({
      data: {
        draw_request_id: draw.id,
        action_type: "imported",
        requested_amount: requested,
        approved_amount: (payload.approved_amount as number | null) ?? null,
        notes: exceeds ? "Imported draw exceeds remaining rehab funds" : null,
      },
    });

    return;
  }

  if (family === "markets") {
    const marketName = String(payload.market_name || "");
    const state = (payload.state as string | null) ?? null;

    const existing = await prisma.sbMarketReference.findFirst({
      where: { market_name: marketName, state },
    });

    if (existing) {
      await prisma.sbMarketReference.update({
        where: { id: existing.id },
        data: {
          is_active: Boolean(payload.is_active ?? true),
          is_future_market: Boolean(payload.is_future_market ?? false),
          is_expansion_market: Boolean(payload.is_expansion_market ?? false),
        },
      });
    } else {
      await prisma.sbMarketReference.create({
        data: {
          market_name: marketName,
          state,
          is_active: Boolean(payload.is_active ?? true),
          is_future_market: Boolean(payload.is_future_market ?? false),
          is_expansion_market: Boolean(payload.is_expansion_market ?? false),
        },
      });
    }
    return;
  }

  if (family === "cash_accounts") {
    await prisma.sbCashAccount.upsert({
      where: { account_name: String(payload.account_name || "") },
      update: {
        current_balance: Number(payload.current_balance || 0),
        updated_on: (payload.updated_on as Date | null) ?? new Date(),
        notes: (payload.notes as string | null) ?? null,
      },
      create: {
        account_name: String(payload.account_name || ""),
        current_balance: Number(payload.current_balance || 0),
        updated_on: (payload.updated_on as Date | null) ?? new Date(),
        notes: (payload.notes as string | null) ?? null,
      },
    });
    return;
  }

  if (family === "portfolio_snapshots") {
    const snapshotDate = (payload.snapshot_date as Date | null) ?? new Date();
    const start = new Date(snapshotDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(snapshotDate);
    end.setHours(23, 59, 59, 999);

    const existing = await prisma.sbPortfolioSnapshot.findFirst({
      where: {
        snapshot_date: {
          gte: start,
          lte: end,
        },
      },
    });

    const data = {
      snapshot_date: snapshotDate,
      total_loans_out: (payload.total_loans_out as number | null) ?? null,
      total_company_cash: (payload.total_company_cash as number | null) ?? null,
      company_cash_out: (payload.company_cash_out as number | null) ?? null,
      total_draw_reserve: (payload.total_draw_reserve as number | null) ?? null,
      upcoming_hml_loans: (payload.upcoming_hml_loans as number | null) ?? null,
      loc_business_balance: (payload.loc_business_balance as number | null) ?? null,
      current_cash_balance: (payload.current_cash_balance as number | null) ?? null,
    };

    if (existing) {
      await prisma.sbPortfolioSnapshot.update({ where: { id: existing.id }, data });
    } else {
      await prisma.sbPortfolioSnapshot.create({ data });
    }
    return;
  }

  if (family === "tax_1098_prep") {
    const borrowerName = String(payload.borrower_name || "");
    const borrower = borrowerName ? await upsertBorrower(borrowerName) : null;
    const sourceReference = String(payload.source_reference || sourceRowKey);

    const existing = await prisma.sbTax1098Prep.findFirst({
      where: {
        OR: [
          { source_reference: sourceReference },
          {
            borrower_name: borrowerName,
            property_address: (payload.property_address as string | null) ?? null,
          },
        ],
      },
    });

    const data = {
      borrower_id: borrower?.id ?? (payload.borrower_id as string | null) ?? null,
      borrower_name: borrowerName,
      loans_closed_2022_count: Number(payload.loans_closed_2022_count || 0),
      loans_closed_2023_count: Number(payload.loans_closed_2023_count || 0),
      active_or_cashout_count: Number(payload.active_or_cashout_count || 0),
      total_loan_count: Number(payload.total_loan_count || 0),
      terms_reference: (payload.terms_reference as string | null) ?? null,
      property_address: (payload.property_address as string | null) ?? null,
      notes: (payload.notes as string | null) ?? null,
      source_reference: sourceReference,
      review_flag: Boolean(payload.review_flag),
    };

    if (existing) {
      await prisma.sbTax1098Prep.update({ where: { id: existing.id }, data });
    } else {
      await prisma.sbTax1098Prep.create({ data });
    }
  }
}

export const GET = withAuth(async (request) => {
  const search = request.nextUrl.searchParams.get("search")?.trim() || "";
  const family = request.nextUrl.searchParams.get("family")?.trim() || "";
  const status = request.nextUrl.searchParams.get("status")?.trim() || "";
  const page = Number(request.nextUrl.searchParams.get("page") || 1);
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 20), 100);

  const where: Prisma.SbImportBatchWhereInput = {
    ...(family ? { source_sheet_family: family } : {}),
    ...(status ? { status: status.toUpperCase() as SbImportStatus } : {}),
    ...(search
      ? {
          OR: [
            { source_sheet_name: { contains: search, mode: "insensitive" } },
            { source_sheet_family: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [batches, total] = await Promise.all([
    prisma.sbImportBatch.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ created_at: "desc" }],
    }),
    prisma.sbImportBatch.count({ where }),
  ]);

  const batchIds = batches.map((batch) => batch.id);
  const statusCounts = batchIds.length > 0
    ? await prisma.sbImportRow.groupBy({
        by: ["batch_id", "status"],
        where: { batch_id: { in: batchIds } },
        _count: { _all: true },
      })
    : [];

  const countsByBatch = statusCounts.reduce<Record<string, Record<string, number>>>((acc, item) => {
    if (!acc[item.batch_id]) acc[item.batch_id] = {};
    acc[item.batch_id][item.status] = item._count._all;
    return acc;
  }, {});

  return NextResponse.json({
    batches: batches.map((batch) => {
      const rowCounts = countsByBatch[batch.id] || {};
      return {
        ...batch,
        rowCounts: {
          valid: rowCounts.VALID || 0,
          invalid: rowCounts.INVALID || 0,
          needsReview: rowCounts.NEEDS_REVIEW || 0,
          corrected: rowCounts.CORRECTED || 0,
          published: rowCounts.PUBLISHED || 0,
        },
      };
    }),
    total,
    page,
    limit,
  });
}, "manage_org_settings");

export const POST = withAuth(async (request, ctx) => {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const familyInput = String(formData.get("sheetFamily") || "");
  const sourceSheetName = String(formData.get("sourceSheetName") || familyInput || "");
  const dryRun = String(formData.get("dryRun") || "true") === "true";

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const family = detectSheetFamily(familyInput);
  if (!family) {
    return NextResponse.json({ error: "Invalid sheetFamily", supported: SHEET_FAMILIES }, { status: 400 });
  }

  const text = await file.text();
  const isJsonFile = file.name.toLowerCase().endsWith(".json") || file.type.includes("json");

  let headers: string[] = [];
  let bodyRows: string[][] = [];

  if (isJsonFile) {
    const parsedJson = parseJsonRows(text);
    headers = parsedJson.headers;
    bodyRows = parsedJson.rows;
  } else {
    const rows = parseCsv(text);
    headers = rows[0]?.map(canonicalHeader) || [];
    bodyRows = rows.slice(1);
  }

  if (headers.length === 0 || bodyRows.length === 0) {
    return NextResponse.json({ error: "File must include headers and data rows" }, { status: 400 });
  }

  const filteredRows = bodyRows.filter((cells) => cells.some((cell) => String(cell).trim() !== ""));
  const marketReferences = await prisma.sbMarketReference.findMany({
    where: { is_active: true },
    select: { market_name: true, state: true },
  });

  const parsed = await Promise.all(
    filteredRows.map((cells, index) => {
      const raw = Object.fromEntries(headers.map((header, headerIndex) => [header, String(cells[headerIndex] ?? "").trim()]));
      return validateAndNormalizeRow(family, sourceSheetName, raw, index + 2, marketReferences);
    })
  );

  const summary = {
    total: parsed.length,
    valid: parsed.filter((row) => row.issues.length === 0).length,
    invalid: parsed.filter((row) => row.issues.some((issue) => issue.severity === "critical")).length,
    needsReview: parsed.filter((row) => row.issues.some((issue) => issue.severity === "warning")).length,
  };

  let batchId: string | null = null;

  if (!dryRun) {
    const batch = await prisma.sbImportBatch.create({
      data: {
        source_sheet_family: family,
        source_sheet_name: sourceSheetName,
        uploaded_by: ctx.user.id,
        status: "VALIDATED",
        total_rows: summary.total,
        valid_rows: summary.total - summary.invalid,
        invalid_rows: summary.invalid,
      },
    });

    batchId = batch.id;

    for (const row of parsed) {
      const hasCritical = row.issues.some((issue) => issue.severity === "critical");
      const hasWarning = row.issues.some((issue) => issue.severity === "warning");

      await prisma.sbImportRow.create({
        data: {
          batch_id: batch.id,
          source_sheet_name: sourceSheetName,
          source_row_number: row.sourceRowNumber,
          source_row_key: row.sourceRowKey,
          payload: row.raw as Prisma.InputJsonValue,
          normalized_payload: row.normalized as Prisma.InputJsonValue,
          status: hasCritical ? "INVALID" : hasWarning ? "NEEDS_REVIEW" : "VALID",
          missing_critical: hasCritical,
          validation_errors: row.issues as Prisma.InputJsonValue,
        },
      });
    }
  }

  return NextResponse.json({
    dryRun,
    batchId,
    family,
    sourceSheetName,
    summary,
    rows: parsed.map((row) => ({
      sourceRowNumber: row.sourceRowNumber,
      sourceRowKey: row.sourceRowKey,
      issues: row.issues,
      normalized: row.normalized,
    })),
  });
}, "manage_org_settings");

export const PATCH = withAuth(async (request, ctx) => {
  const body = await request.json();
  const batchId = String(body.batchId || "");
  const rowId = String(body.rowId || "");
  const publish = Boolean(body.publish);
  const note = typeof body.note === "string" ? body.note : null;
  const action = String(body.action || (publish ? (rowId ? "publish-row" : "publish-batch") : "correct"));
  const corrections = Array.isArray(body.corrections)
    ? (body.corrections as Array<{ rowId: string; adminCorrection: Record<string, unknown>; note?: string | null }>)
    : [];
  const adminCorrection = body.adminCorrection && typeof body.adminCorrection === "object"
    ? (body.adminCorrection as Record<string, unknown>)
    : {};

  if (!batchId && !rowId) {
    return NextResponse.json({ error: "batchId or rowId is required" }, { status: 400 });
  }

  let batch = batchId ? await prisma.sbImportBatch.findUnique({ where: { id: batchId } }) : null;

  if (!batch && rowId) {
    const row = await prisma.sbImportRow.findUnique({ where: { id: rowId }, include: { batch: true } });
    batch = row?.batch ?? null;
  }

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const auditEntityType = getAuditEntityType(batch.source_sheet_family);

  const applyCorrection = async (targetRowId: string, values: Record<string, unknown>, targetNote?: string | null) => {
    const row = await prisma.sbImportRow.findUnique({ where: { id: targetRowId } });
    if (!row) return;

    const currentPayload = getMergedPayload(row);
    const changes = Object.entries(values)
      .filter(([field, nextValue]) => !valuesMatch(currentPayload[field], nextValue))
      .map(([field, nextValue]) => ({
        fieldName: field,
        oldValue: currentPayload[field] ?? null,
        newValue: nextValue,
      }));
    const nextState = buildCorrectionState(row.admin_correction, values, ctx.user.id, targetNote, "corrected");
    await prisma.sbImportRow.update({
      where: { id: targetRowId },
      data: {
        admin_correction: nextState as Prisma.InputJsonValue,
        status: "CORRECTED",
      },
    });

    await recordRemediationAudit(targetRowId, auditEntityType, "corrected", changes, ctx.user.id, targetNote);
  };

  if (action === "correct" && rowId) {
    await applyCorrection(rowId, adminCorrection, note);
    return NextResponse.json({ rowId, corrected: true });
  }

  for (const correction of corrections) {
    await applyCorrection(correction.rowId, correction.adminCorrection, correction.note ?? null);
  }

  let publishedCount = 0;
  if (publish || action === "publish-row" || action === "publish-batch") {
    const family = detectSheetFamily(batch.source_sheet_family);
    if (!family) {
      return NextResponse.json({ error: "Batch sheet family is invalid" }, { status: 400 });
    }

    const rows = await prisma.sbImportRow.findMany({
      where: rowId
        ? {
            id: rowId,
            status: { in: ["VALID", "CORRECTED", "PUBLISHED"].filter(isPublishableRowStatus) as Array<"VALID" | "CORRECTED" | "PUBLISHED"> },
          }
        : {
            batch_id: batch.id,
            status: { in: ["VALID", "CORRECTED", "PUBLISHED"].filter(isPublishableRowStatus) as Array<"VALID" | "CORRECTED" | "PUBLISHED"> },
          },
      orderBy: { source_row_number: "asc" },
    });

    if (rowId && rows.length === 0) {
      const targetRow = await prisma.sbImportRow.findUnique({
        where: { id: rowId },
        select: { status: true },
      });

      return NextResponse.json(
        {
          error: targetRow
            ? `Row status ${targetRow.status} is not publishable. Save a correction first.`
            : "Row not found",
        },
        { status: targetRow ? 400 : 404 }
      );
    }

    for (const row of rows) {
      const mergedPayload = getMergedPayload(row);
      await publishRow(
        family,
        batch.source_sheet_name,
        row.source_row_key || `${batch.source_sheet_name}:${row.source_row_number}`,
        mergedPayload
      );

      const correctionState = buildCorrectionState(row.admin_correction, {}, ctx.user.id, note, "published");
      await prisma.sbImportRow.update({
        where: { id: row.id },
        data: {
          admin_correction: correctionState as Prisma.InputJsonValue,
          status: "PUBLISHED",
          published_at: new Date(),
        },
      });

      await recordRemediationAudit(
        row.id,
        auditEntityType,
        "published",
        [{ fieldName: "status", oldValue: row.status, newValue: "PUBLISHED" }],
        ctx.user.id,
        note
      );

      publishedCount += 1;
    }

    const unresolvedCount = await prisma.sbImportRow.count({
      where: {
        batch_id: batch.id,
        status: { in: ["INVALID", "NEEDS_REVIEW"] },
      },
    });

    await prisma.sbImportBatch.update({
      where: { id: batch.id },
      data: { status: unresolvedCount === 0 ? "PUBLISHED" : "VALIDATED" },
    });
  }

  return NextResponse.json({
    batchId: batch.id,
    correctionsApplied: corrections.length + (rowId && Object.keys(adminCorrection).length > 0 ? 1 : 0),
    publishedCount,
    published: publish || action === "publish-row" || action === "publish-batch",
  });
}, "manage_org_settings");
