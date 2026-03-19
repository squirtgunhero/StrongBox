import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

const REPORT_VIEWS = {
  dashboard_portfolio_summary: "dashboard_portfolio_summary",
  report_active_exposure: "report_active_exposure",
  report_exposure_by_state: "report_exposure_by_state",
  report_exposure_by_market: "report_exposure_by_market",
  report_loan_type_summary: "report_loan_type_summary",
  report_upcoming_loans: "report_upcoming_loans",
  report_closed_projects_by_year: "report_closed_projects_by_year",
  report_1098_prep: "report_1098_prep",
} as const;

type ReportView = keyof typeof REPORT_VIEWS;

type ReportFilters = {
  state: string | null;
  market: string | null;
  loanType: string | null;
  borrower: string | null;
  fromDate: string | null;
  toDate: string | null;
};

type ReportSqlSet = {
  rowsSql: Prisma.Sql;
  countSql: Prisma.Sql;
  summarySql?: Prisma.Sql;
  availableFiltersSql?: Prisma.Sql;
};

function parsePositiveInteger(value: string | null, fallback: number, max = 200) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.trunc(parsed), max);
}

function parseDateValue(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildWhere(clauses: Prisma.Sql[]) {
  if (clauses.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}`;
}

function buildActiveLoanClauses(filters: ReportFilters, dateColumn?: string) {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`l.loan_stage = 'active'`,
    Prisma.sql`l.loan_status IN ('active', 'funded')`,
  ];

  if (filters.state) clauses.push(Prisma.sql`COALESCE(p.state, 'Unknown') = ${filters.state}`);
  if (filters.market) clauses.push(Prisma.sql`COALESCE(p.market_name, 'Unmapped') = ${filters.market}`);
  if (filters.loanType) clauses.push(Prisma.sql`COALESCE(l.loan_type, 'Unknown') = ${filters.loanType}`);
  if (filters.borrower) clauses.push(Prisma.sql`COALESCE(b.legal_name, '') ILIKE ${`%${filters.borrower}%`}`);
  if (dateColumn && filters.fromDate) clauses.push(Prisma.sql`${Prisma.raw(dateColumn)}::date >= ${filters.fromDate}::date`);
  if (dateColumn && filters.toDate) clauses.push(Prisma.sql`${Prisma.raw(dateColumn)}::date <= ${filters.toDate}::date`);

  return clauses;
}

function buildUpcomingLoanClauses(filters: ReportFilters, dateColumn?: string) {
  const clauses: Prisma.Sql[] = [Prisma.sql`l.loan_stage = 'upcoming'`];

  if (filters.state) clauses.push(Prisma.sql`COALESCE(p.state, 'Unknown') = ${filters.state}`);
  if (filters.market) clauses.push(Prisma.sql`COALESCE(p.market_name, 'Unmapped') = ${filters.market}`);
  if (filters.loanType) clauses.push(Prisma.sql`COALESCE(l.loan_type, 'Unknown') = ${filters.loanType}`);
  if (filters.borrower) clauses.push(Prisma.sql`COALESCE(b.legal_name, '') ILIKE ${`%${filters.borrower}%`}`);
  if (dateColumn && filters.fromDate) clauses.push(Prisma.sql`${Prisma.raw(dateColumn)}::date >= ${filters.fromDate}::date`);
  if (dateColumn && filters.toDate) clauses.push(Prisma.sql`${Prisma.raw(dateColumn)}::date <= ${filters.toDate}::date`);

  return clauses;
}

function buildClosedHistoryClauses(filters: ReportFilters) {
  const clauses: Prisma.Sql[] = [];
  const fromDate = parseDateValue(filters.fromDate);
  const toDate = parseDateValue(filters.toDate);

  if (filters.state) clauses.push(Prisma.sql`COALESCE(h.state, 'Unknown') = ${filters.state}`);
  if (filters.loanType) clauses.push(Prisma.sql`COALESCE(h.loan_type, 'Unknown') = ${filters.loanType}`);
  if (filters.borrower) clauses.push(Prisma.sql`COALESCE(h.borrower_name, '') ILIKE ${`%${filters.borrower}%`}`);
  if (fromDate) clauses.push(Prisma.sql`h.closed_year >= ${fromDate.getFullYear()}`);
  if (toDate) clauses.push(Prisma.sql`h.closed_year <= ${toDate.getFullYear()}`);

  return clauses;
}

function buildTaxPrepClauses(filters: ReportFilters) {
  const clauses: Prisma.Sql[] = [];
  if (filters.borrower) clauses.push(Prisma.sql`COALESCE(t.borrower_name, '') ILIKE ${`%${filters.borrower}%`}`);
  return clauses;
}

function buildFacetClauses(filters: ReportFilters) {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`l.loan_stage = 'active'`,
    Prisma.sql`l.loan_status IN ('active', 'funded')`,
  ];

  if (filters.borrower) clauses.push(Prisma.sql`COALESCE(b.legal_name, '') ILIKE ${`%${filters.borrower}%`}`);
  if (filters.fromDate) clauses.push(Prisma.sql`l.maturity_date::date >= ${filters.fromDate}::date`);
  if (filters.toDate) clauses.push(Prisma.sql`l.maturity_date::date <= ${filters.toDate}::date`);

  return clauses;
}

function buildReportSql(view: ReportView, filters: ReportFilters, page: number, limit: number): ReportSqlSet {
  const offset = (page - 1) * limit;

  if (view === "report_active_exposure") {
    const whereSql = buildWhere(buildActiveLoanClauses(filters, "l.maturity_date"));
    const baseSql = Prisma.sql`
      SELECT
        l.id,
        b.legal_name AS borrower,
        p.full_address AS property,
        p.state,
        COALESCE(p.market_name, 'Unmapped') AS market_name,
        l.loan_type,
        l.loan_status,
        l.principal_total,
        l.arv,
        l.ltv,
        l.rehab_amount,
        l.draw_reserve,
        l.maturity_date,
        CASE
          WHEN l.maturity_date IS NULL THEN NULL
          ELSE (l.maturity_date::date - CURRENT_DATE)
        END AS days_to_maturity
      FROM loans l
      LEFT JOIN borrowers b ON b.id = l.borrower_id
      LEFT JOIN properties p ON p.id = l.property_id
      ${whereSql}
    `;
    const facetWhere = buildWhere(buildFacetClauses(filters));

    return {
      rowsSql: Prisma.sql`${baseSql} ORDER BY l.maturity_date NULLS LAST, b.legal_name LIMIT ${limit} OFFSET ${offset}`,
      countSql: Prisma.sql`SELECT COUNT(*)::int AS total FROM (${baseSql}) AS count_rows`,
      summarySql: Prisma.sql`
        SELECT
          COALESCE(SUM(principal_total), 0)::numeric(18,2) AS total_exposure,
          COUNT(*)::int AS total_rows,
          COALESCE(SUM(CASE WHEN ltv > 0.75 OR (days_to_maturity IS NOT NULL AND days_to_maturity <= 30) OR market_name = 'Unmapped' THEN 1 ELSE 0 END), 0)::int AS flagged_count,
          COUNT(DISTINCT COALESCE(state, 'Unknown'))::int AS state_count,
          COUNT(DISTINCT market_name)::int AS market_count
        FROM (${baseSql}) AS summary_rows
      `,
      availableFiltersSql: Prisma.sql`
        SELECT
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(p.state, 'Unknown') ORDER BY COALESCE(p.state, 'Unknown')), NULL) AS states,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(p.market_name, 'Unmapped') ORDER BY COALESCE(p.market_name, 'Unmapped')), NULL) AS markets,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(l.loan_type, 'Unknown') ORDER BY COALESCE(l.loan_type, 'Unknown')), NULL) AS loan_types
        FROM loans l
        LEFT JOIN borrowers b ON b.id = l.borrower_id
        LEFT JOIN properties p ON p.id = l.property_id
        ${facetWhere}
      `,
    };
  }

  if (view === "report_exposure_by_state") {
    const baseSql = Prisma.sql`
      SELECT
        COALESCE(p.state, 'Unknown') AS state,
        COUNT(*)::int AS active_loan_count,
        COALESCE(SUM(l.principal_total), 0)::numeric(18,2) AS total_exposure,
        AVG(l.ltv)::numeric(12,6) AS average_ltv
      FROM loans l
      LEFT JOIN borrowers b ON b.id = l.borrower_id
      LEFT JOIN properties p ON p.id = l.property_id
      ${buildWhere(buildActiveLoanClauses(filters))}
      GROUP BY COALESCE(p.state, 'Unknown')
    `;

    return {
      rowsSql: Prisma.sql`${baseSql} ORDER BY total_exposure DESC LIMIT ${limit} OFFSET ${offset}`,
      countSql: Prisma.sql`SELECT COUNT(*)::int AS total FROM (${baseSql}) AS count_rows`,
    };
  }

  if (view === "report_exposure_by_market") {
    const baseSql = Prisma.sql`
      SELECT
        COALESCE(p.market_name, 'Unmapped') AS market_name,
        COUNT(*)::int AS active_loan_count,
        COALESCE(SUM(l.principal_total), 0)::numeric(18,2) AS total_exposure
      FROM loans l
      LEFT JOIN borrowers b ON b.id = l.borrower_id
      LEFT JOIN properties p ON p.id = l.property_id
      ${buildWhere(buildActiveLoanClauses(filters))}
      GROUP BY COALESCE(p.market_name, 'Unmapped')
    `;

    return {
      rowsSql: Prisma.sql`${baseSql} ORDER BY total_exposure DESC LIMIT ${limit} OFFSET ${offset}`,
      countSql: Prisma.sql`SELECT COUNT(*)::int AS total FROM (${baseSql}) AS count_rows`,
    };
  }

  if (view === "report_loan_type_summary") {
    const baseSql = Prisma.sql`
      SELECT
        COALESCE(l.loan_type, 'Unknown') AS loan_type,
        COUNT(*)::int AS active_count,
        COALESCE(SUM(l.principal_total), 0)::numeric(18,2) AS active_principal_total
      FROM loans l
      LEFT JOIN borrowers b ON b.id = l.borrower_id
      LEFT JOIN properties p ON p.id = l.property_id
      ${buildWhere(buildActiveLoanClauses(filters))}
      GROUP BY COALESCE(l.loan_type, 'Unknown')
    `;

    return {
      rowsSql: Prisma.sql`${baseSql} ORDER BY active_principal_total DESC LIMIT ${limit} OFFSET ${offset}`,
      countSql: Prisma.sql`SELECT COUNT(*)::int AS total FROM (${baseSql}) AS count_rows`,
    };
  }

  if (view === "report_upcoming_loans") {
    const baseSql = Prisma.sql`
      SELECT
        l.id,
        b.legal_name AS borrower,
        p.full_address AS property,
        p.state,
        COALESCE(p.market_name, 'Unmapped') AS market_name,
        l.loan_type,
        l.origination_date AS target_funding_date,
        l.principal_total AS total_loan,
        l.draw_reserve,
        COALESCE(l.total_cash_currently_needed, l.upfront_cash_required, 0)::numeric(18,2) AS cash_needed_now,
        l.title_company
      FROM loans l
      LEFT JOIN borrowers b ON b.id = l.borrower_id
      LEFT JOIN properties p ON p.id = l.property_id
      ${buildWhere(buildUpcomingLoanClauses(filters, "l.origination_date"))}
    `;

    return {
      rowsSql: Prisma.sql`${baseSql} ORDER BY l.origination_date NULLS LAST, b.legal_name LIMIT ${limit} OFFSET ${offset}`,
      countSql: Prisma.sql`SELECT COUNT(*)::int AS total FROM (${baseSql}) AS count_rows`,
      summarySql: Prisma.sql`
        SELECT
          COALESCE(SUM(cash_needed_now), 0)::numeric(18,2) AS cash_needed_total,
          COUNT(*)::int AS total_rows
        FROM (${baseSql}) AS summary_rows
      `,
    };
  }

  if (view === "report_closed_projects_by_year") {
    const baseSql = Prisma.sql`
      SELECT
        h.closed_year AS year,
        COUNT(*)::int AS count,
        COALESCE(SUM(h.principal), 0)::numeric(18,2) AS principal_total,
        AVG(h.years_outstanding)::numeric(10,4) AS average_hold_years
      FROM annual_loan_history h
      ${buildWhere(buildClosedHistoryClauses(filters))}
      GROUP BY h.closed_year
    `;

    return {
      rowsSql: Prisma.sql`${baseSql} ORDER BY year DESC LIMIT ${limit} OFFSET ${offset}`,
      countSql: Prisma.sql`SELECT COUNT(*)::int AS total FROM (${baseSql}) AS count_rows`,
    };
  }

  if (view === "report_1098_prep") {
    const baseSql = Prisma.sql`
      SELECT
        t.id,
        t.borrower_name AS borrower,
        t.loans_closed_2022_count,
        t.loans_closed_2023_count,
        t.active_or_cashout_count,
        t.total_loan_count,
        t.property_address AS latest_property,
        t.terms_reference AS latest_terms_reference,
        (t.review_flag OR t.source_reference IS NULL OR t.source_reference = '') AS review_flag
      FROM tax_1098_prep t
      ${buildWhere(buildTaxPrepClauses(filters))}
    `;

    return {
      rowsSql: Prisma.sql`${baseSql} ORDER BY borrower ASC LIMIT ${limit} OFFSET ${offset}`,
      countSql: Prisma.sql`SELECT COUNT(*)::int AS total FROM (${baseSql}) AS count_rows`,
      summarySql: Prisma.sql`
        SELECT
          COUNT(*)::int AS total_rows,
          COALESCE(SUM(CASE WHEN review_flag THEN 1 ELSE 0 END), 0)::int AS flagged_count
        FROM (${baseSql}) AS summary_rows
      `,
    };
  }

  return {
    rowsSql: Prisma.sql`SELECT * FROM ${Prisma.raw(REPORT_VIEWS[view])} LIMIT ${limit} OFFSET ${offset}`,
    countSql: Prisma.sql`SELECT COUNT(*)::int AS total FROM ${Prisma.raw(REPORT_VIEWS[view])}`,
  };
}

export const GET = withAuth(async (request) => {
  const viewParam = request.nextUrl.searchParams.get("view") as ReportView | null;

  if (!viewParam || !(viewParam in REPORT_VIEWS)) {
    return NextResponse.json(
      {
        error: "Invalid view parameter",
        supportedViews: Object.keys(REPORT_VIEWS),
      },
      { status: 400 }
    );
  }

  const page = parsePositiveInteger(request.nextUrl.searchParams.get("page"), 1, 1000);
  const limit = parsePositiveInteger(request.nextUrl.searchParams.get("limit"), 25, 250);
  const filters: ReportFilters = {
    state: request.nextUrl.searchParams.get("state")?.trim() || null,
    market: request.nextUrl.searchParams.get("market")?.trim() || null,
    loanType: request.nextUrl.searchParams.get("loanType")?.trim() || null,
    borrower: request.nextUrl.searchParams.get("borrower")?.trim() || null,
    fromDate: request.nextUrl.searchParams.get("fromDate")?.trim() || null,
    toDate: request.nextUrl.searchParams.get("toDate")?.trim() || null,
  };

  const sqlSet = buildReportSql(viewParam, filters, page, limit);
  const queries: Array<Promise<unknown>> = [
    prisma.$queryRaw<Array<Record<string, unknown>>>(sqlSet.rowsSql),
    prisma.$queryRaw<Array<{ total: number }>>(sqlSet.countSql),
  ];

  if (sqlSet.summarySql) {
    queries.push(prisma.$queryRaw<Array<Record<string, unknown>>>(sqlSet.summarySql));
  }

  if (sqlSet.availableFiltersSql) {
    queries.push(
      prisma.$queryRaw<Array<{ states: string[] | null; markets: string[] | null; loan_types: string[] | null }>>(
        sqlSet.availableFiltersSql
      )
    );
  }

  const [rows, countRows, summaryRows, availableFilterRows] = await Promise.all(queries);
  const total = Array.isArray(countRows) && countRows[0] ? Number(countRows[0].total || 0) : 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const summary = Array.isArray(summaryRows) && summaryRows[0] ? summaryRows[0] : null;
  const availableFilters = Array.isArray(availableFilterRows) && availableFilterRows[0]
    ? {
        states: availableFilterRows[0].states || [],
        markets: availableFilterRows[0].markets || [],
        loanTypes: availableFilterRows[0].loan_types || [],
      }
    : null;

  return NextResponse.json({
    view: REPORT_VIEWS[viewParam],
    rowCount: total,
    pageRowCount: Array.isArray(rows) ? rows.length : 0,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    filters,
    summary,
    availableFilters,
    data: rows,
  });
}, "view_reports");
