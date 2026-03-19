import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { Prisma, SbImportRowStatus } from "@prisma/client";

type ValidationIssue = {
  code?: string;
  field?: string;
  message?: string;
  severity?: string;
  reviewFlag?: boolean;
  suggestedValue?: unknown;
  metadata?: Record<string, unknown>;
};

type CorrectionAuditEntry = {
  action?: string;
  appliedAt?: string;
  appliedBy?: string | null;
  note?: string | null;
  fields?: string[];
};

function getCorrectionState(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { values: {}, history: [] as CorrectionAuditEntry[] };
  }

  const raw = value as Record<string, unknown>;
  const history = Array.isArray(raw.history) ? (raw.history as CorrectionAuditEntry[]) : [];
  const values = raw.values && typeof raw.values === "object" && !Array.isArray(raw.values)
    ? (raw.values as Record<string, unknown>)
    : (raw as Record<string, unknown>);

  return { values, history };
}

function getIssueCodes(issues: ValidationIssue[]) {
  return Array.from(new Set(issues.map((issue) => issue.code).filter(Boolean))) as string[];
}

function mapIssueToWorkflow(issueCode: string) {
  switch (issueCode) {
    case "missing_arv":
      return "missing ARV";
    case "high_ltv":
      return "high LTV";
    case "exceeded_draw_limits":
      return "exceeded draw limits";
    case "unmapped_market":
      return "unmapped market";
    case "matured_unpaid":
      return "matured unpaid loan";
    case "broken_tax_prep_reference":
      return "broken tax-prep reference";
    default:
      return issueCode.replace(/_/g, " ");
  }
}

export const GET = withAuth(async (request) => {
  const statusFilter = request.nextUrl.searchParams.get("status");
  const batchId = request.nextUrl.searchParams.get("batchId")?.trim();
  const rowId = request.nextUrl.searchParams.get("rowId")?.trim();
  const normalizedStatus = statusFilter?.toUpperCase() as SbImportRowStatus | undefined;

  const where: Prisma.SbImportRowWhereInput = statusFilter
    ? { status: normalizedStatus }
    : { status: { in: ["INVALID", "NEEDS_REVIEW", "CORRECTED", "PUBLISHED"] } };

  if (batchId) where.batch_id = batchId;
  if (rowId) where.id = rowId;

  const rows = await prisma.sbImportRow.findMany({
    where,
    include: {
      batch: {
        select: {
          id: true,
          source_sheet_family: true,
          source_sheet_name: true,
          created_at: true,
          status: true,
        },
      },
      remediation_audits: {
        orderBy: [{ created_at: "desc" }],
      },
    },
    orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
    take: 500,
  });

  const queue = rows.map((row) => {
    const issues = Array.isArray(row.validation_errors) ? (row.validation_errors as ValidationIssue[]) : [];
    const correctionState = getCorrectionState(row.admin_correction);
    const normalizedPayload = (row.normalized_payload as Record<string, unknown> | null) || {};
    const mergedPayload = {
      ...normalizedPayload,
      ...correctionState.values,
    };
    const issueCodes = getIssueCodes(issues);

    return {
      id: row.id,
      status: row.status,
      source_sheet_name: row.source_sheet_name,
      source_row_number: row.source_row_number,
      source_row_key: row.source_row_key,
      missing_critical: row.missing_critical,
      validation_errors: issues,
      issue_codes: issueCodes,
      remediation_labels: issueCodes.map(mapIssueToWorkflow),
      payload: row.payload,
      normalized_payload: normalizedPayload,
      merged_payload: mergedPayload,
      correction_values: correctionState.values,
      correction_history: correctionState.history,
      remediation_audits: row.remediation_audits,
      published_at: row.published_at,
      updated_at: row.updated_at,
      batch: row.batch,
    };
  });

  const summary = {
    total: queue.length,
    invalid: queue.filter((row) => row.status === "INVALID").length,
    needsReview: queue.filter((row) => row.status === "NEEDS_REVIEW").length,
    corrected: queue.filter((row) => row.status === "CORRECTED").length,
    byFamily: queue.reduce<Record<string, number>>((acc, row) => {
      const family = row.batch.source_sheet_family;
      acc[family] = (acc[family] || 0) + 1;
      return acc;
    }, {}),
  };

  return NextResponse.json({ queue, summary });
}, "manage_org_settings");
