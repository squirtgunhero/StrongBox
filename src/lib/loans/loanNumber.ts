import { prisma } from "@/lib/prisma";

/**
 * Generate the next loan number in format SIL-YYYY-NNNN
 */
export async function generateLoanNumber(
  organizationId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SIL-${year}-`;

  const lastLoan = await prisma.loan.findFirst({
    where: {
      organizationId,
      loanNumber: { startsWith: prefix },
    },
    orderBy: { loanNumber: "desc" },
    select: { loanNumber: true },
  });

  let nextNumber = 1;
  if (lastLoan) {
    const lastNum = parseInt(lastLoan.loanNumber.split("-")[2], 10);
    nextNumber = lastNum + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
}
