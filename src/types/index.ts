import type {
  Loan,
  Contact,
  Property,
  Payment,
  Draw,
  Document,
  Task,
  User,
  CapitalSource,
  CapitalAllocation,
  Notification,
  AuditLog,
  LoanStatusHistory,
  LoanCondition,
  Communication,
  SbAnnualLoanHistory,
  SbBorrower,
  SbCashAccount,
  SbDrawRequest,
  SbDrawRequestAudit,
  SbImportBatch,
  SbImportRow,
  SbMarketReference,
  SbPortfolioSnapshot,
  SbProperty,
  SbRemediationAudit,
  SbTax1098Prep,
  SbLoan,
} from "@prisma/client";

// Re-export Prisma types for convenience
export type {
  Loan,
  Contact,
  Property,
  Payment,
  Draw,
  Document,
  Task,
  User,
  CapitalSource,
  CapitalAllocation,
  Notification,
  AuditLog,
  LoanStatusHistory,
  LoanCondition,
  Communication,
  SbAnnualLoanHistory,
  SbBorrower,
  SbCashAccount,
  SbDrawRequest,
  SbDrawRequestAudit,
  SbImportBatch,
  SbImportRow,
  SbMarketReference,
  SbPortfolioSnapshot,
  SbProperty,
  SbRemediationAudit,
  SbTax1098Prep,
  SbLoan,
};

// Loan with all relations loaded
export type LoanWithRelations = Loan & {
  borrower: Contact;
  guarantor?: Contact | null;
  loanOfficer?: User | null;
  processor?: User | null;
  underwriter?: User | null;
  property?: Property | null;
  draws: Draw[];
  payments: Payment[];
  documents: Document[];
  tasks: Task[];
  capitalAllocations: (CapitalAllocation & { capitalSource: CapitalSource })[];
  loanConditions: LoanCondition[];
  statusHistory: LoanStatusHistory[];
};

// Contact with loan counts
export type ContactWithLoans = Contact & {
  loans: Loan[];
  guaranteedLoans: Loan[];
};

// Dashboard metrics
export interface PortfolioMetrics {
  totalLoans: number;
  totalOutstanding: number;
  weightedAverageRate: number;
  averageLTV: number;
  delinquentCount: number;
  maturityNext30Days: number;
}

export interface PipelineSummary {
  leads: number;
  applications: number;
  processing: number;
  underwriting: number;
  approved: number;
  closing: number;
  totalPipelineValue: number;
}

export interface CashPosition {
  totalAvailable: number;
  totalDeployed: number;
  bySource: {
    sourceId: string;
    sourceName: string;
    type: string;
    available: number;
    deployed: number;
    limit: number;
  }[];
}

export type StrongboxLoanWithRelations = SbLoan & {
  borrower: SbBorrower;
  property?: SbProperty | null;
  draw_requests: SbDrawRequest[];
  annual_history: SbAnnualLoanHistory[];
};

export type StrongboxBorrowerWithRelations = SbBorrower & {
  properties: SbProperty[];
  loans: SbLoan[];
  tax_1098_records: SbTax1098Prep[];
};

export type StrongboxDrawRequestWithRelations = SbDrawRequest & {
  loan: SbLoan & {
    borrower: SbBorrower;
    property?: SbProperty | null;
  };
  audit_entries: SbDrawRequestAudit[];
};

export interface StrongboxDashboardSummary {
  currentCash: number;
  loansOut: number;
  activeExposure: number;
  totalCompanyCash: number;
  drawReserve: number;
  fundingPressure: number;
  upcomingFundingNeed: number;
  pendingDrawRequests: number;
  maturitiesIn30Days: number;
  activeLoanCount: number;
  snapshotAsOf: string | null;
}

export interface StrongboxReportActiveExposureRow {
  id: string;
  borrower: string;
  property: string | null;
  state: string | null;
  market_name: string;
  loan_type: string | null;
  loan_status: string;
  principal_total: number | string | null;
  arv: number | string | null;
  ltv: number | string | null;
  rehab_amount: number | string | null;
  draw_reserve: number | string | null;
  maturity_date: string | null;
  days_to_maturity: number | null;
}

export interface StrongboxExposureByStateRow {
  state: string;
  active_loan_count: number;
  total_exposure: number | string;
  average_ltv: number | string | null;
}

export interface StrongboxExposureByMarketRow {
  market_name: string;
  active_loan_count: number;
  total_exposure: number | string;
}

export interface StrongboxLoanTypeSummaryRow {
  loan_type: string;
  active_count: number;
  active_principal_total: number | string;
}

export interface StrongboxUpcomingLoanRow {
  id: string;
  borrower: string;
  property: string | null;
  target_funding_date: string | null;
  total_loan: number | string | null;
  draw_reserve: number | string | null;
  cash_needed_now: number | string;
  title_company: string | null;
}

export interface StrongboxClosedProjectsByYearRow {
  year: number;
  count: number;
  principal_total: number | string;
  average_hold_years: number | string | null;
}

export interface StrongboxTax1098PrepRow {
  id: string;
  borrower: string;
  loans_closed_2022_count: number;
  loans_closed_2023_count: number;
  active_or_cashout_count: number;
  total_loan_count: number;
  latest_property: string | null;
  latest_terms_reference: string | null;
  review_flag: boolean;
}

export interface StrongboxImportSummary {
  total: number;
  valid: number;
  invalid: number;
  needsReview: number;
}
