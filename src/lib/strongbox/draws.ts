export type DrawApprovalInput = {
  loanStatus: string;
  amountRequested: number;
  approvedAmount: number;
  remainingRehabFunds: number;
  adminOverrideEnabled: boolean;
};

export type DrawApprovalDecision = {
  allowed: boolean;
  exception: boolean;
  reason: string | null;
};

export function evaluateDrawApproval(input: DrawApprovalInput): DrawApprovalDecision {
  const loanStatus = input.loanStatus.toLowerCase();

  if (loanStatus !== "active" && loanStatus !== "funded") {
    return {
      allowed: false,
      exception: false,
      reason: "Loan must be active before approving a draw",
    };
  }

  if (input.approvedAmount <= 0) {
    return {
      allowed: false,
      exception: false,
      reason: "Approved amount must be greater than 0",
    };
  }

  if (input.approvedAmount > input.amountRequested) {
    return {
      allowed: false,
      exception: false,
      reason: "Approved amount cannot exceed requested amount",
    };
  }

  if (input.approvedAmount > input.remainingRehabFunds && !input.adminOverrideEnabled) {
    return {
      allowed: false,
      exception: true,
      reason: "Approved amount exceeds remaining rehab funds",
    };
  }

  return {
    allowed: true,
    exception: input.approvedAmount > input.remainingRehabFunds,
    reason: null,
  };
}
