import Decimal from "decimal.js";
import { addMonths } from "date-fns";
import { calculateMonthlyIOPayment } from "@/lib/loans/calculations";

export interface ScheduledPayment {
  dueDate: Date;
  amount: Decimal;
  principalAmount: Decimal;
  interestAmount: Decimal;
  isFinal: boolean;
}

/**
 * Generate an interest-only payment schedule
 */
export function generateIOSchedule(params: {
  loanAmount: Decimal;
  annualRate: Decimal;
  termMonths: number;
  firstPaymentDate: Date;
}): ScheduledPayment[] {
  const { loanAmount, annualRate, termMonths, firstPaymentDate } = params;
  const monthlyPayment = calculateMonthlyIOPayment(loanAmount, annualRate);
  const schedule: ScheduledPayment[] = [];

  for (let i = 0; i < termMonths; i++) {
    const dueDate = addMonths(firstPaymentDate, i);
    const isFinal = i === termMonths - 1;

    schedule.push({
      dueDate,
      amount: isFinal ? loanAmount.plus(monthlyPayment) : monthlyPayment,
      principalAmount: isFinal ? loanAmount : new Decimal(0),
      interestAmount: monthlyPayment,
      isFinal,
    });
  }

  return schedule;
}
