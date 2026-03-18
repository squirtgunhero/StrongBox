import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Calculate daily interest rate using actual/360 convention
 */
export function dailyRate(annualRate: Decimal): Decimal {
  return annualRate.div(100).div(360);
}

/**
 * Calculate interest for a period using actual/360
 */
export function calculateInterest(
  balance: Decimal,
  annualRate: Decimal,
  days: number
): Decimal {
  return balance.mul(dailyRate(annualRate)).mul(days).toDecimalPlaces(2);
}

/**
 * Calculate LTV ratio
 */
export function calculateLTV(
  loanAmount: Decimal,
  propertyValue: Decimal
): Decimal {
  if (propertyValue.isZero()) return new Decimal(0);
  return loanAmount.div(propertyValue).mul(100).toDecimalPlaces(2);
}

/**
 * Calculate ARV LTV ratio
 */
export function calculateARVLTV(
  loanAmount: Decimal,
  arv: Decimal
): Decimal {
  if (arv.isZero()) return new Decimal(0);
  return loanAmount.div(arv).mul(100).toDecimalPlaces(2);
}

/**
 * Calculate monthly interest-only payment
 */
export function calculateMonthlyIOPayment(
  balance: Decimal,
  annualRate: Decimal
): Decimal {
  return balance
    .mul(annualRate.div(100))
    .div(12)
    .toDecimalPlaces(2);
}

/**
 * Calculate payoff amount
 */
export function calculatePayoff(params: {
  currentBalance: Decimal;
  annualRate: Decimal;
  daysSinceLastPayment: number;
  outstandingFees: Decimal;
  lateCharges: Decimal;
  processingFee: Decimal;
  escrowCredits: Decimal;
}): Decimal {
  const accruedInterest = calculateInterest(
    params.currentBalance,
    params.annualRate,
    params.daysSinceLastPayment
  );

  return params.currentBalance
    .plus(accruedInterest)
    .plus(params.outstandingFees)
    .plus(params.lateCharges)
    .plus(params.processingFee)
    .minus(params.escrowCredits)
    .toDecimalPlaces(2);
}
