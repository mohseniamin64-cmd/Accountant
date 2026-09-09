export type StatementAccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'income'
  | 'expense';

export interface StatementSourceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: StatementAccountType;
  amountIrr: string;
}

export interface FinancialStatementLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  amountIrr: string;
}

export interface ProfitLossReport {
  from: string;
  to: string;
  incomeLines: FinancialStatementLine[];
  expenseLines: FinancialStatementLine[];
  totalIncomeIrr: string;
  totalExpenseIrr: string;
  netProfitIrr: string;
}

export interface BalanceSheetReport {
  asOf: string;
  assetLines: FinancialStatementLine[];
  liabilityLines: FinancialStatementLine[];
  equityLines: FinancialStatementLine[];
  totalAssetsIrr: string;
  totalLiabilitiesIrr: string;
  recordedEquityIrr: string;
  unclosedEarningsIrr: string;
  totalEquityIrr: string;
  liabilitiesAndEquityIrr: string;
  differenceIrr: string;
  isBalanced: boolean;
}

function amountTotal(
  rows: readonly StatementSourceRow[],
  type: StatementAccountType,
): bigint {
  return rows
    .filter((row) => row.accountType === type)
    .reduce((sum, row) => sum + BigInt(row.amountIrr), 0n);
}

function statementLines(
  rows: readonly StatementSourceRow[],
  type: StatementAccountType,
): FinancialStatementLine[] {
  return rows
    .filter(
      (row) => row.accountType === type && BigInt(row.amountIrr) !== 0n,
    )
    .map(({accountId, accountCode, accountName, amountIrr}) => ({
      accountId,
      accountCode,
      accountName,
      amountIrr,
    }));
}

export function buildProfitLossReport(
  rows: readonly StatementSourceRow[],
  from: string,
  to: string,
): ProfitLossReport {
  const totalIncome = amountTotal(rows, 'income');
  const totalExpense = amountTotal(rows, 'expense');
  return {
    from,
    to,
    incomeLines: statementLines(rows, 'income'),
    expenseLines: statementLines(rows, 'expense'),
    totalIncomeIrr: totalIncome.toString(),
    totalExpenseIrr: totalExpense.toString(),
    netProfitIrr: (totalIncome - totalExpense).toString(),
  };
}

export function buildBalanceSheetReport(
  rows: readonly StatementSourceRow[],
  asOf: string,
): BalanceSheetReport {
  const totalAssets = amountTotal(rows, 'asset');
  const totalLiabilities = amountTotal(rows, 'liability');
  const recordedEquity = amountTotal(rows, 'equity');
  const unclosedEarnings =
    amountTotal(rows, 'income') - amountTotal(rows, 'expense');
  const totalEquity = recordedEquity + unclosedEarnings;
  const liabilitiesAndEquity = totalLiabilities + totalEquity;
  const difference = totalAssets - liabilitiesAndEquity;
  return {
    asOf,
    assetLines: statementLines(rows, 'asset'),
    liabilityLines: statementLines(rows, 'liability'),
    equityLines: statementLines(rows, 'equity'),
    totalAssetsIrr: totalAssets.toString(),
    totalLiabilitiesIrr: totalLiabilities.toString(),
    recordedEquityIrr: recordedEquity.toString(),
    unclosedEarningsIrr: unclosedEarnings.toString(),
    totalEquityIrr: totalEquity.toString(),
    liabilitiesAndEquityIrr: liabilitiesAndEquity.toString(),
    differenceIrr: difference.toString(),
    isBalanced: difference === 0n,
  };
}
