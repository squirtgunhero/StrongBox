import { differenceInCalendarDays } from "date-fns";

export type Numeric = number | null | undefined;

export type StrongboxLoanLike = {
  loan_stage?: string | null;
  loan_status?: string | null;
  loan_type?: string | null;
  principal_total?: Numeric;
  purchase_amount?: Numeric;
  rehab_amount?: Numeric;
  arv?: Numeric;
  ltv?: Numeric;
  maturity_date?: Date | string | null;
  payoff_date?: Date | string | null;
  approved_draws_total?: Numeric;
  requested_draw_amount?: Numeric;
  market_name?: string | null;
  borrower_email?: string | null;
  borrower_phone?: string | null;
  title_company?: string | null;
  tax_prep_source_reference?: string | null;
};

export type RiskFlag =
  | "missing_arv"
  | "ltv_over_threshold"
  | "draw_request_exceeds_available_rehab"
  | "maturity_within_30_days"
  | "maturity_within_60_days"
  | "matured_unpaid"
  | "no_payoff_date_on_matured_loan"
  | "missing_borrower_contact_info"
  | "unmapped_market"
  | "inconsistent_principal_vs_purchase_plus_rehab"
  | "missing_title_company_on_upcoming_loan"
  | "broken_tax_prep_reference";

function toNumber(value: Numeric): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSheetName(sheetName: string): string {
  return sheetName.trim().toLowerCase().replace(/\s+/g, " ");
}

export function calculatePrincipalTotal(
  purchaseAmount: Numeric,
  rehabAmount: Numeric,
  sourcePrincipal?: Numeric
): number | null {
  const direct = toNumber(sourcePrincipal);
  if (direct != null) return direct;

  const purchase = toNumber(purchaseAmount) ?? 0;
  const rehab = toNumber(rehabAmount) ?? 0;

  if (purchaseAmount == null && rehabAmount == null) {
    return null;
  }

  return purchase + rehab;
}

export function calculateLtv(principalTotal: Numeric, arv: Numeric): number | null {
  const principal = toNumber(principalTotal);
  const afterRepairValue = toNumber(arv);

  if (principal == null || afterRepairValue == null || afterRepairValue === 0) {
    return null;
  }

  return principal / afterRepairValue;
}

export function calculateRehabRatio(rehabAmount: Numeric, principalTotal: Numeric): number | null {
  const rehab = toNumber(rehabAmount);
  const principal = toNumber(principalTotal);

  if (rehab == null || principal == null || principal === 0) {
    return null;
  }

  return rehab / principal;
}

export function calculateYearsOutstanding(
  originationDate: Date | string | null | undefined,
  payoffDate: Date | string | null | undefined
): number | null {
  if (!originationDate || !payoffDate) return null;

  const origination = new Date(originationDate);
  const payoff = new Date(payoffDate);

  if (Number.isNaN(origination.getTime()) || Number.isNaN(payoff.getTime())) {
    return null;
  }

  const diffMs = payoff.getTime() - origination.getTime();
  if (diffMs < 0) return null;

  return diffMs / (1000 * 60 * 60 * 24 * 365);
}

export function calculateDaysToMaturity(
  maturityDate: Date | string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!maturityDate) return null;

  const maturity = new Date(maturityDate);
  if (Number.isNaN(maturity.getTime())) return null;

  return differenceInCalendarDays(maturity, now);
}

export function calculateRemainingRehabFunds(rehabAmount: Numeric, approvedDraws: Numeric): number | null {
  const rehab = toNumber(rehabAmount);
  if (rehab == null) return null;

  const approved = toNumber(approvedDraws) ?? 0;
  return rehab - approved;
}

export function getLoanStageFromSourceSheet(sheetName: string):
  | "application"
  | "upcoming"
  | "active"
  | "closed" {
  const normalized = normalizeSheetName(sheetName);

  if (normalized === "open applications") return "application";
  if (normalized === "upcoming loans") return "upcoming";
  if (normalized === "cash out") return "active";
  if (normalized === "exposure") return "active";
  if (normalized.startsWith("closed projects")) return "closed";

  return "application";
}

export function getRiskFlags(
  loan: StrongboxLoanLike,
  options?: { ltvThreshold?: number; now?: Date; drawOverrideEnabled?: boolean }
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const ltvThreshold = options?.ltvThreshold ?? 0.75;
  const now = options?.now ?? new Date();

  const principal = calculatePrincipalTotal(
    loan.purchase_amount,
    loan.rehab_amount,
    loan.principal_total
  );
  const ltv = toNumber(loan.ltv) ?? calculateLtv(principal, loan.arv);

  if (toNumber(loan.arv) == null || toNumber(loan.arv) === 0) {
    flags.push("missing_arv");
  }

  if (ltv != null && ltv > ltvThreshold) {
    flags.push("ltv_over_threshold");
  }

  const remainingRehab = calculateRemainingRehabFunds(
    loan.rehab_amount,
    loan.approved_draws_total
  );
  const requestedDraw = toNumber(loan.requested_draw_amount);

  if (
    remainingRehab != null &&
    requestedDraw != null &&
    requestedDraw > remainingRehab &&
    !options?.drawOverrideEnabled
  ) {
    flags.push("draw_request_exceeds_available_rehab");
  }

  const daysToMaturity = calculateDaysToMaturity(loan.maturity_date, now);
  if (daysToMaturity != null && daysToMaturity <= 30 && daysToMaturity >= 0) {
    flags.push("maturity_within_30_days");
  } else if (daysToMaturity != null && daysToMaturity <= 60 && daysToMaturity > 30) {
    flags.push("maturity_within_60_days");
  }

  const status = (loan.loan_status ?? "").toLowerCase();
  if (daysToMaturity != null && daysToMaturity < 0 && !loan.payoff_date) {
    flags.push("matured_unpaid");
    if (status === "active" || status === "funded" || status === "matured") {
      flags.push("no_payoff_date_on_matured_loan");
    }
  }

  if (!loan.borrower_email && !loan.borrower_phone) {
    flags.push("missing_borrower_contact_info");
  }

  if (!loan.market_name || loan.market_name.toLowerCase() === "unmapped") {
    flags.push("unmapped_market");
  }

  const purchase = toNumber(loan.purchase_amount) ?? 0;
  const rehab = toNumber(loan.rehab_amount) ?? 0;
  const sourcePrincipal = toNumber(loan.principal_total);
  if (sourcePrincipal != null) {
    const derived = purchase + rehab;
    const delta = Math.abs(sourcePrincipal - derived);
    if (delta > 1) {
      flags.push("inconsistent_principal_vs_purchase_plus_rehab");
    }
  }

  if ((loan.loan_stage ?? "").toLowerCase() === "upcoming" && !loan.title_company) {
    flags.push("missing_title_company_on_upcoming_loan");
  }

  if (!loan.tax_prep_source_reference && (loan.loan_stage ?? "").toLowerCase() === "closed") {
    flags.push("broken_tax_prep_reference");
  }

  return Array.from(new Set(flags));
}

export function aggregateExposureByState(
  loans: Array<Pick<StrongboxLoanLike, "loan_stage" | "loan_status" | "principal_total"> & { state?: string | null }>
): Array<{ state: string; active_loan_count: number; total_exposure: number }> {
  const grouped = new Map<string, { state: string; active_loan_count: number; total_exposure: number }>();

  for (const loan of loans) {
    const stage = (loan.loan_stage ?? "").toLowerCase();
    const status = (loan.loan_status ?? "").toLowerCase();
    const countsForExposure = stage === "active" && (status === "funded" || status === "active");
    if (!countsForExposure) continue;

    const state = (loan.state ?? "Unknown").trim() || "Unknown";
    const exposure = toNumber(loan.principal_total) ?? 0;

    if (!grouped.has(state)) {
      grouped.set(state, { state, active_loan_count: 0, total_exposure: 0 });
    }

    const row = grouped.get(state)!;
    row.active_loan_count += 1;
    row.total_exposure += exposure;
  }

  return Array.from(grouped.values()).sort((a, b) => b.total_exposure - a.total_exposure);
}

export function aggregateExposureByLoanType(
  loans: Array<Pick<StrongboxLoanLike, "loan_stage" | "loan_status" | "loan_type" | "principal_total">>
): Array<{ loan_type: string; active_count: number; active_principal_total: number }> {
  const grouped = new Map<string, { loan_type: string; active_count: number; active_principal_total: number }>();

  for (const loan of loans) {
    const stage = (loan.loan_stage ?? "").toLowerCase();
    const status = (loan.loan_status ?? "").toLowerCase();
    const countsForExposure = stage === "active" && (status === "funded" || status === "active");
    if (!countsForExposure) continue;

    const loanType = (loan.loan_type ?? "Unknown").trim() || "Unknown";
    const principal = toNumber(loan.principal_total) ?? 0;

    if (!grouped.has(loanType)) {
      grouped.set(loanType, {
        loan_type: loanType,
        active_count: 0,
        active_principal_total: 0,
      });
    }

    const row = grouped.get(loanType)!;
    row.active_count += 1;
    row.active_principal_total += principal;
  }

  return Array.from(grouped.values()).sort((a, b) => b.active_principal_total - a.active_principal_total);
}
