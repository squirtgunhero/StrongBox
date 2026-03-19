export type CashFormulaConfig = {
  includeLocInCashOut: boolean;
  companyCashOutMode: "loans_minus_reserves_minus_loc" | "admin_override";
  adminOverrideCompanyCashOut?: number | null;
};

export type CashPositionInput = {
  loansOut: number;
  reserves: number;
  locBalances: number;
  currentCashBalance: number;
  config: CashFormulaConfig;
};

export type CashPositionResult = {
  companyCashOut: number;
  totalCompanyCash: number;
  currentCashBalance: number;
};

export function calculateCashPosition(input: CashPositionInput): CashPositionResult {
  const baseCashOut = input.loansOut - input.reserves - (input.config.includeLocInCashOut ? input.locBalances : 0);

  const companyCashOut =
    input.config.companyCashOutMode === "admin_override"
      ? Number(input.config.adminOverrideCompanyCashOut ?? 0)
      : baseCashOut;

  const totalCompanyCash = input.currentCashBalance + companyCashOut;

  return {
    companyCashOut,
    totalCompanyCash,
    currentCashBalance: input.currentCashBalance,
  };
}
