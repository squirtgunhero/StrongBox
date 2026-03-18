import Decimal from "decimal.js";
import { differenceInCalendarDays } from "date-fns";
import { calculateInterest } from "@/lib/loans/calculations";

/**
 * Calculate accrued interest between two dates using actual/360
 */
export function accruedInterest(
  balance: Decimal,
  annualRate: Decimal,
  fromDate: Date,
  toDate: Date
): Decimal {
  const days = differenceInCalendarDays(toDate, fromDate);
  if (days <= 0) return new Decimal(0);
  return calculateInterest(balance, annualRate, days);
}
