import { LoanStatus } from "@prisma/client";

// Valid status transitions
const TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  LEAD: [LoanStatus.APPLICATION, LoanStatus.CANCELLED],
  APPLICATION: [LoanStatus.PROCESSING, LoanStatus.CANCELLED],
  PROCESSING: [LoanStatus.UNDERWRITING, LoanStatus.CANCELLED],
  UNDERWRITING: [
    LoanStatus.CONDITIONAL_APPROVAL,
    LoanStatus.DENIED,
    LoanStatus.CANCELLED,
  ],
  CONDITIONAL_APPROVAL: [
    LoanStatus.APPROVED,
    LoanStatus.DENIED,
    LoanStatus.CANCELLED,
  ],
  APPROVED: [LoanStatus.CLOSING, LoanStatus.CANCELLED],
  CLOSING: [LoanStatus.FUNDED, LoanStatus.CANCELLED],
  FUNDED: [LoanStatus.ACTIVE],
  ACTIVE: [
    LoanStatus.EXTENDED,
    LoanStatus.PAYOFF_REQUESTED,
    LoanStatus.PAID_OFF,
    LoanStatus.DEFAULT,
  ],
  EXTENDED: [
    LoanStatus.ACTIVE,
    LoanStatus.PAYOFF_REQUESTED,
    LoanStatus.PAID_OFF,
    LoanStatus.DEFAULT,
  ],
  PAYOFF_REQUESTED: [LoanStatus.PAID_OFF, LoanStatus.ACTIVE],
  PAID_OFF: [],
  DEFAULT: [LoanStatus.FORECLOSURE, LoanStatus.ACTIVE],
  FORECLOSURE: [LoanStatus.REO, LoanStatus.ACTIVE],
  REO: [LoanStatus.PAID_OFF],
  CANCELLED: [],
  DENIED: [],
};

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAvailableTransitions(status: LoanStatus): LoanStatus[] {
  return TRANSITIONS[status] ?? [];
}

/**
 * Guard conditions that must be met before a status transition is allowed.
 * Returns null if the guard passes, or a string error message if it fails.
 */
export type GuardCheckResult = { passed: boolean; message?: string };

export interface TransitionGuard {
  from: LoanStatus;
  to: LoanStatus;
  description: string;
  check: (loan: LoanGuardData) => GuardCheckResult;
}

export interface LoanGuardData {
  id: string;
  borrowerId: string;
  propertyId: string | null;
  loanOfficerId: string | null;
  processorId: string | null;
  underwriterId: string | null;
  loanAmount: number;
  interestRate: number;
  termMonths: number;
  riskScore: number | null;
  // Counts from relations
  requiredDocsReceived?: boolean;
  conditionsCleared?: boolean;
  priorToApprovalCleared?: boolean;
  priorToFundingCleared?: boolean;
  hasPaymentSchedule?: boolean;
}

export const TRANSITION_GUARDS: TransitionGuard[] = [
  {
    from: LoanStatus.APPLICATION,
    to: LoanStatus.PROCESSING,
    description: "Borrower info and property address are required",
    check: (loan) => ({
      passed: !!loan.borrowerId && !!loan.propertyId,
      message: !loan.borrowerId
        ? "Borrower must be assigned"
        : !loan.propertyId
        ? "Property address is required"
        : undefined,
    }),
  },
  {
    from: LoanStatus.PROCESSING,
    to: LoanStatus.UNDERWRITING,
    description: "All required documents must be received",
    check: (loan) => ({
      passed: loan.requiredDocsReceived !== false,
      message: "Not all required documents have been received",
    }),
  },
  {
    from: LoanStatus.UNDERWRITING,
    to: LoanStatus.CONDITIONAL_APPROVAL,
    description: "Underwriter must be assigned",
    check: (loan) => ({
      passed: !!loan.underwriterId,
      message: "An underwriter must be assigned before conditional approval",
    }),
  },
  {
    from: LoanStatus.CONDITIONAL_APPROVAL,
    to: LoanStatus.APPROVED,
    description: "All prior-to-approval conditions must be cleared",
    check: (loan) => ({
      passed: loan.priorToApprovalCleared !== false,
      message: "Outstanding prior-to-approval conditions must be cleared",
    }),
  },
  {
    from: LoanStatus.CLOSING,
    to: LoanStatus.FUNDED,
    description: "All prior-to-funding conditions must be cleared",
    check: (loan) => ({
      passed: loan.priorToFundingCleared !== false,
      message: "Outstanding prior-to-funding conditions must be cleared",
    }),
  },
];

/**
 * Run guards for a specific transition.
 * Returns an array of failed guard messages, or empty array if all pass.
 */
export function checkTransitionGuards(
  from: LoanStatus,
  to: LoanStatus,
  loanData: LoanGuardData
): string[] {
  const failures: string[] = [];
  const guards = TRANSITION_GUARDS.filter(
    (g) => g.from === from && g.to === to
  );

  for (const guard of guards) {
    const result = guard.check(loanData);
    if (!result.passed) {
      failures.push(result.message || guard.description);
    }
  }

  return failures;
}

/**
 * Side effects to trigger after a successful status transition.
 */
export interface TransitionSideEffect {
  toStatus: LoanStatus;
  tasks: { title: string; assigneeField: string; dueDays: number; priority: string }[];
  notifications: {
    userField: string;
    title: string;
    message: string;
  }[];
}

export const TRANSITION_SIDE_EFFECTS: TransitionSideEffect[] = [
  {
    toStatus: LoanStatus.APPLICATION,
    tasks: [
      {
        title: "Review loan application",
        assigneeField: "loanOfficerId",
        dueDays: 2,
        priority: "HIGH",
      },
    ],
    notifications: [],
  },
  {
    toStatus: LoanStatus.PROCESSING,
    tasks: [
      {
        title: "Order title search",
        assigneeField: "processorId",
        dueDays: 3,
        priority: "HIGH",
      },
      {
        title: "Verify borrower documentation",
        assigneeField: "processorId",
        dueDays: 5,
        priority: "MEDIUM",
      },
      {
        title: "Order appraisal / BPO",
        assigneeField: "processorId",
        dueDays: 3,
        priority: "HIGH",
      },
    ],
    notifications: [],
  },
  {
    toStatus: LoanStatus.UNDERWRITING,
    tasks: [
      {
        title: "Complete underwriting review",
        assigneeField: "underwriterId",
        dueDays: 5,
        priority: "HIGH",
      },
    ],
    notifications: [],
  },
  {
    toStatus: LoanStatus.APPROVED,
    tasks: [
      {
        title: "Prepare closing documents",
        assigneeField: "processorId",
        dueDays: 5,
        priority: "HIGH",
      },
      {
        title: "Send approval letter to borrower",
        assigneeField: "loanOfficerId",
        dueDays: 1,
        priority: "HIGH",
      },
    ],
    notifications: [],
  },
  {
    toStatus: LoanStatus.CLOSING,
    tasks: [
      {
        title: "Schedule closing",
        assigneeField: "processorId",
        dueDays: 3,
        priority: "HIGH",
      },
      {
        title: "Confirm wire instructions",
        assigneeField: "processorId",
        dueDays: 2,
        priority: "URGENT",
      },
    ],
    notifications: [],
  },
  {
    toStatus: LoanStatus.FUNDED,
    tasks: [
      {
        title: "Generate payment schedule",
        assigneeField: "processorId",
        dueDays: 1,
        priority: "URGENT",
      },
      {
        title: "Set up servicing",
        assigneeField: "processorId",
        dueDays: 3,
        priority: "HIGH",
      },
    ],
    notifications: [],
  },
  {
    toStatus: LoanStatus.DEFAULT,
    tasks: [
      {
        title: "Send default notice to borrower",
        assigneeField: "loanOfficerId",
        dueDays: 1,
        priority: "URGENT",
      },
      {
        title: "Review default management options",
        assigneeField: "loanOfficerId",
        dueDays: 3,
        priority: "URGENT",
      },
    ],
    notifications: [],
  },
];

export function getSideEffects(toStatus: LoanStatus): TransitionSideEffect | undefined {
  return TRANSITION_SIDE_EFFECTS.find((e) => e.toStatus === toStatus);
}
