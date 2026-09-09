import type {AmountUnit} from '../../shared/contracts.js';
import {amountInputToIrr} from './master-data.helpers.js';
import type {
  AccountingAccountOption,
  AccountingReportType,
  FiscalYearStatus,
  JournalDraftLine,
  JournalPayloadLine,
  JournalStatus,
} from './accounting.types.js';

export function todayInTehran(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function journalStatusText(status: JournalStatus): string {
  if (status === 'draft') return 'پیش‌نویس';
  if (status === 'posted') return 'قطعی';
  return 'برگشت‌شده';
}

export function fiscalYearStatusText(status: FiscalYearStatus): string {
  if (status === 'open') return 'باز';
  if (status === 'soft_closed') return 'بسته موقت';
  return 'بسته نهایی';
}

export function reportTypeText(type: AccountingReportType): string {
  if (type === 'journal') return 'دفتر روزنامه';
  if (type === 'general-ledger') return 'دفتر کل';
  if (type === 'trial-balance') return 'تراز آزمایشی';
  if (type === 'ledger') return 'دفتر حساب';
  if (type === 'profit-loss') return 'صورت سود و زیان';
  return 'ترازنامه';
}

function nullableText(value: string): string | null {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function lineAmount(value: string, unit: AmountUnit): string {
  return amountInputToIrr(value.trim() === '' ? '0' : value, unit);
}

export function validateAndBuildJournalLines(
  lines: readonly JournalDraftLine[],
  accounts: readonly AccountingAccountOption[],
  unit: AmountUnit,
): JournalPayloadLine[] {
  if (lines.length < 2) {
    throw new Error('سند حسابداری باید حداقل دو ردیف داشته باشد.');
  }
  let totalDebit = 0n;
  let totalCredit = 0n;
  const payload = lines.map((line, index) => {
    const row = index + 1;
    const account = accounts.find((item) => item.id === line.accountId);
    if (!account || !account.allowsPosting) {
      throw new Error(`حساب انتخاب‌شده در ردیف ${row} قابل ثبت نیست.`);
    }
    const debitIrr = lineAmount(line.debit, unit);
    const creditIrr = lineAmount(line.credit, unit);
    const debit = BigInt(debitIrr);
    const credit = BigInt(creditIrr);
    if ((debit > 0n) === (credit > 0n)) {
      throw new Error(
        `در ردیف ${row} فقط یکی از مبلغ بدهکار یا بستانکار باید بیشتر از صفر باشد.`,
      );
    }
    if (account.requiresParty && !line.partyId) {
      throw new Error(`انتخاب طرف‌حساب برای ردیف ${row} الزامی است.`);
    }
    if (account.requiresBranch && !line.branchId) {
      throw new Error(`انتخاب شعبه برای ردیف ${row} الزامی است.`);
    }
    totalDebit += debit;
    totalCredit += credit;
    return {
      accountId: line.accountId,
      partyId: line.partyId || null,
      branchId: line.branchId || null,
      description: nullableText(line.description),
      debitIrr,
      creditIrr,
    };
  });
  if (totalDebit === 0n || totalDebit !== totalCredit) {
    throw new Error('جمع بدهکار و بستانکار سند باید برابر و بیشتر از صفر باشد.');
  }
  return payload;
}

export function journalTotals(
  lines: readonly JournalDraftLine[],
  unit: AmountUnit,
): {debitIrr: bigint; creditIrr: bigint} {
  return lines.reduce(
    (total, line) => {
      try {
        total.debitIrr += BigInt(lineAmount(line.debit, unit));
      } catch {
        // An incomplete input is represented as zero until formal validation.
      }
      try {
        total.creditIrr += BigInt(lineAmount(line.credit, unit));
      } catch {
        // An incomplete input is represented as zero until formal validation.
      }
      return total;
    },
    {debitIrr: 0n, creditIrr: 0n},
  );
}

export function formatSignedIrr(
  value: bigint | string,
  unit: AmountUnit,
): string {
  const irr = typeof value === 'bigint' ? value : BigInt(value || '0');
  const negative = irr < 0n;
  const absolute = negative ? -irr : irr;
  if (unit === 'IRR') {
    const formatted = new Intl.NumberFormat('fa-IR').format(absolute);
    return (negative ? '−' : '') + formatted + ' ریال';
  }
  const whole = absolute / 10n;
  const fraction = absolute % 10n;
  const formatted = new Intl.NumberFormat('fa-IR').format(whole) +
    (fraction === 0n
      ? ''
      : '٫' + new Intl.NumberFormat('fa-IR').format(fraction));
  return (negative ? '−' : '') + formatted + ' تومان';
}

export function selectedFiscalRange(
  fiscalYears: readonly {
    startsOn: string;
    endsOn: string;
    status: FiscalYearStatus;
  }[],
): {from: string; to: string} | null {
  const selected =
    fiscalYears.find((item) => item.status === 'open') ?? fiscalYears[0];
  return selected ? {from: selected.startsOn, to: selected.endsOn} : null;
}
