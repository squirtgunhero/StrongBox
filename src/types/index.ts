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
