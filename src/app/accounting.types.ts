export type JournalStatus = 'draft' | 'posted' | 'reversed';
export type FiscalYearStatus = 'open' | 'soft_closed' | 'final_closed';
export type AccountLevel = 'group' | 'general' | 'subsidiary' | 'floating';
export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'income'
  | 'expense'
  | 'memo';
export type NormalBalance = 'debit' | 'credit';
export type AccountingTab = 'journals' | 'fiscal-years' | 'reports';
export type AccountingReportType =
  | 'journal'
  | 'general-ledger'
  | 'trial-balance'
  | 'ledger'
  | 'profit-loss'
  | 'balance-sheet';

export interface AccountingAccountOption {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  accountLevel: AccountLevel;
  accountType: AccountType;
  normalBalance: NormalBalance;
  allowsPosting: boolean;
  requiresParty: boolean;
  requiresBranch: boolean;
}

export interface AccountingBranchOption {
  id: string;
  code: string;
  name: string;
  isHeadOffice: boolean;
}

export interface AccountingPartyOption {
  id: string;
  code: string;
  displayName: string;
}

export interface FiscalYear {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  status: FiscalYearStatus;
  closedAt: string | null;
  rowVersion: number;
}

export interface AccountingOptions {
  accounts: AccountingAccountOption[];
  branches: AccountingBranchOption[];
  parties: AccountingPartyOption[];
  fiscalYears: FiscalYear[];
}

export interface JournalSummary {
  id: string;
  entryNumber: string;
  entryDate: string;
  referenceNumber: string | null;
  description: string;
  status: JournalStatus;
  sourceType: string;
  rowVersion: number;
  createdByName: string;
  postedByName: string | null;
  debitIrr: string;
  creditIrr: string;
}

export interface JournalLineDetail {
  id: string;
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  partyId: string | null;
  partyName: string | null;
  branchId: string | null;
  description: string | null;
  debitIrr: string;
  creditIrr: string;
}

export interface JournalDetail {
  id: string;
  branchId: string;
  fiscalYearId: string;
  entryNumber: string;
  entryDate: string;
  documentDate: string | null;
  referenceNumber: string | null;
  description: string;
  status: JournalStatus;
  sourceType: string;
  rowVersion: number;
  lines: JournalLineDetail[];
}

export interface JournalDraftLine {
  key: string;
  accountId: string;
  partyId: string;
  branchId: string;
  description: string;
  debit: string;
  credit: string;
}

export interface JournalDraft {
  id: string | null;
  rowVersion: number | null;
  branchId: string;
  entryDate: string;
  documentDate: string;
  referenceNumber: string;
  description: string;
  lines: JournalDraftLine[];
}

export interface JournalPayloadLine {
  accountId: string;
  partyId: string | null;
  branchId: string | null;
  description: string | null;
  debitIrr: string;
  creditIrr: string;
}

export interface JournalPayload {
  branchId: string;
  entryDate: string;
  documentDate: string | null;
  referenceNumber: string | null;
  description: string;
  lines: JournalPayloadLine[];
  postNow: boolean;
}

export interface JournalCreated {
  id: string;
  entryNumber: string;
  fiscalYearId: string;
  status: JournalStatus;
}

export interface JournalUpdated {
  id: string;
  rowVersion: number;
}

export interface JournalReportRow {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  referenceNumber: string | null;
  entryDescription: string;
  lineNumber: number;
  accountCode: string;
  accountName: string;
  partyName: string | null;
  branchName: string | null;
  description: string | null;
  debitIrr: string;
  creditIrr: string;
}

export interface BalanceReportRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitIrr: string;
  creditIrr: string;
  balanceIrr: string;
}

export interface LedgerLine {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  referenceNumber: string | null;
  entryDescription: string;
  partyName: string | null;
  branchName: string | null;
  description: string | null;
  debitIrr: string;
  creditIrr: string;
  runningBalanceIrr: string;
}

export interface LedgerReport {
  account: {
    id: string;
    code: string;
    name: string;
  };
  openingBalanceIrr: string;
  lines: LedgerLine[];
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
