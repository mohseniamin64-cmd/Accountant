import {BookOpenText, FileSearch, RefreshCw} from 'lucide-react';
import {useMemo, useState, type FormEvent} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage} from './api.js';
import {
  formatSignedIrr,
  reportTypeText,
  selectedFiscalRange,
} from './accounting.helpers.js';
import type {
  AccountingOptions,
  AccountingReportType,
  BalanceSheetReport,
  BalanceReportRow,
  JournalReportRow,
  LedgerReport,
  ProfitLossReport,
} from './accounting.types.js';
import {
  BalanceSheetStatement,
  ProfitLossStatement,
} from './AccountingFinancialStatements.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {JalaliDateField} from './JalaliDateField.js';
import {formatJalaliDate, jalaliInputToIso} from './jalali-date.js';
import {ActionFeedback} from './MasterDataUi.js';

interface Props {
  amountUnit: AmountUnit;
  options: AccountingOptions;
}

export function AccountingReportsPanel({amountUnit, options}: Props) {
  const defaultRange = useMemo(
    () => selectedFiscalRange(options.fiscalYears),
    [options.fiscalYears],
  );
  const postingAccounts = useMemo(
    () => options.accounts.filter((account) => account.allowsPosting),
    [options.accounts],
  );
  const [type, setType] = useState<AccountingReportType>('trial-balance');
  const [accountId, setAccountId] = useState('');
  const [journalRows, setJournalRows] = useState<JournalReportRow[] | null>(
    null,
  );
  const [balanceRows, setBalanceRows] = useState<BalanceReportRow[] | null>(
    null,
  );
  const [ledger, setLedger] = useState<LedgerReport | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLossReport | null>(null);
  const [balanceSheet, setBalanceSheet] =
    useState<BalanceSheetReport | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function clearResults() {
    setJournalRows(null);
    setBalanceRows(null);
    setLedger(null);
    setProfitLoss(null);
    setBalanceSheet(null);
    setSuccess(null);
  }

  function changeType(next: AccountingReportType) {
    setType(next);
    clearResults();
  }

  async function loadReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      clearResults();
      const to = jalaliInputToIso(String(form.get('to') ?? ''));
      const from = type === 'balance-sheet'
        ? to
        : jalaliInputToIso(String(form.get('from') ?? ''));
      if (from > to) {
        throw new Error('تاریخ پایان گزارش باید بعد از تاریخ شروع باشد.');
      }
      const params = new URLSearchParams({from, to});
      if (type === 'journal') {
        const rows = await api<JournalReportRow[]>(
          '/api/accounting/reports/journal?' + params.toString(),
        );
        setJournalRows(rows);
        setBalanceRows(null);
        setLedger(null);
        setSuccess(`گزارش روزنامه با ${new Intl.NumberFormat('fa-IR').format(rows.length)} ردیف محاسبه شد.`);
      } else if (type === 'ledger') {
        if (!accountId) {
          throw new Error('برای دفتر حساب، یک حساب قابل ثبت انتخاب کنید.');
        }
        const result = await api<LedgerReport>(
          `/api/accounting/reports/ledger/${accountId}?${params.toString()}`,
        );
        setLedger(result);
        setJournalRows(null);
        setBalanceRows(null);
        setSuccess(`دفتر حساب «${result.account.name}» محاسبه شد.`);
      } else if (type === 'profit-loss') {
        const report = await api<ProfitLossReport>(
          '/api/accounting/reports/profit-loss?' + params.toString(),
        );
        setProfitLoss(report);
        setSuccess('صورت سود و زیان از اسناد قطعی و برگشتی محاسبه شد.');
      } else if (type === 'balance-sheet') {
        const report = await api<BalanceSheetReport>(
          '/api/accounting/reports/balance-sheet?asOf=' +
            encodeURIComponent(to),
        );
        setBalanceSheet(report);
        setSuccess(
          report.isBalanced
            ? 'ترازنامه محاسبه شد و معادله حسابداری برقرار است.'
            : 'ترازنامه محاسبه شد اما معادله حسابداری اختلاف دارد.',
        );
      } else {
        const rows = await api<BalanceReportRow[]>(
          `/api/accounting/reports/${type}?${params.toString()}`,
        );
        setBalanceRows(rows);
        setJournalRows(null);
        setLedger(null);
        setSuccess(
          `${reportTypeText(type)} با ${new Intl.NumberFormat('fa-IR').format(rows.length)} حساب محاسبه شد.`,
        );
      }
    } catch (caught) {
      clearResults();
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const noResult =
    journalRows === null &&
    balanceRows === null &&
    ledger === null &&
    profitLoss === null &&
    balanceSheet === null;

  return (
    <section className="accounting-section business-forms">
      <header className="section-heading accounting-section-heading">
        <ContextHelpButton help={appHelp.accountingReports} />
        <div>
          <p>فقط اسناد قطعی در بازه انتخاب‌شده محاسبه می‌شوند</p>
          <h2>گزارش‌های حسابداری</h2>
        </div>
      </header>

      <form
        className="accounting-report-filter"
        key={defaultRange ? defaultRange.from + defaultRange.to : 'empty'}
        onSubmit={(event) => void loadReport(event)}
      >
        <label className="field">
          <span>نوع گزارش *</span>
          <select
            onChange={(event) =>
              changeType(event.target.value as AccountingReportType)
            }
            value={type}
          >
            <option value="trial-balance">تراز آزمایشی</option>
            <option value="journal">دفتر روزنامه</option>
            <option value="general-ledger">دفتر کل</option>
            <option value="ledger">دفتر حساب (معین/تفصیلی)</option>
            <option value="profit-loss">صورت سود و زیان</option>
            <option value="balance-sheet">ترازنامه</option>
          </select>
        </label>
        {type !== 'balance-sheet' ? (
          <JalaliDateField
            defaultIsoValue={defaultRange?.from}
            label="از تاریخ"
            name="from"
            required
          />
        ) : null}
        <JalaliDateField
          defaultIsoValue={defaultRange?.to}
          label="تا تاریخ"
          name="to"
          required
        />
        {type === 'ledger' ? (
          <label className="field accounting-report-account">
            <span>حساب قابل ثبت *</span>
            <select
              onChange={(event) => setAccountId(event.target.value)}
              required
              value={accountId}
            >
              <option value="">انتخاب حساب</option>
              {postingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="accounting-report-actions">
          <button
            className="button primary"
            disabled={pending || !defaultRange}
            type="submit"
          >
            {pending ? <RefreshCw aria-hidden /> : <FileSearch aria-hidden />}
            {pending ? 'در حال محاسبه…' : 'محاسبه گزارش'}
          </button>
        </div>
      </form>

      {!defaultRange ? (
        <div className="form-message error" role="alert">
          برای تهیه گزارش ابتدا یک سال مالی واقعی تعریف کنید.
        </div>
      ) : null}
      <ActionFeedback error={error} success={success} />

      {noResult ? (
        <div className="empty-state card">
          نوع گزارش و بازه شمسی را انتخاب و «محاسبه گزارش» را بزنید.
        </div>
      ) : null}

      {profitLoss ? (
        <ProfitLossStatement amountUnit={amountUnit} report={profitLoss} />
      ) : null}

      {balanceSheet ? (
        <BalanceSheetStatement amountUnit={amountUnit} report={balanceSheet} />
      ) : null}

      {balanceRows ? (
        <div className="accounting-report-result">
          <header className="form-section-heading">
            <BookOpenText aria-hidden />
            <div>
              <p>مقادیر مستقیماً از ردیف‌های قطعی اسناد محاسبه شده‌اند</p>
              <h3>{reportTypeText(type)}</h3>
            </div>
          </header>
          {balanceRows.length === 0 ? (
            <div className="empty-state">در این بازه گردش حسابی وجود ندارد.</div>
          ) : (
            <>
              <div className="accounting-table-desktop table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>کد حساب</th>
                      <th>نام حساب</th>
                      <th>بدهکار</th>
                      <th>بستانکار</th>
                      <th>مانده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceRows.map((row) => (
                      <tr key={row.accountId}>
                        <td>{row.accountCode}</td>
                        <td>{row.accountName}</td>
                        <td>{formatSignedIrr(row.debitIrr, amountUnit)}</td>
                        <td>{formatSignedIrr(row.creditIrr, amountUnit)}</td>
                        <td
                          className={
                            BigInt(row.balanceIrr) < 0n
                              ? 'balance-credit'
                              : 'balance-debit'
                          }
                        >
                          {formatSignedIrr(row.balanceIrr, amountUnit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="accounting-cards-mobile">
                {balanceRows.map((row) => (
                  <article className="accounting-report-card" key={row.accountId}>
                    <header>
                      <strong>{row.accountName}</strong>
                      <span>{row.accountCode}</span>
                    </header>
                    <dl>
                      <div><dt>بدهکار</dt><dd>{formatSignedIrr(row.debitIrr, amountUnit)}</dd></div>
                      <div><dt>بستانکار</dt><dd>{formatSignedIrr(row.creditIrr, amountUnit)}</dd></div>
                      <div><dt>مانده</dt><dd>{formatSignedIrr(row.balanceIrr, amountUnit)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {journalRows ? (
        <div className="accounting-report-result">
          <header className="form-section-heading">
            <BookOpenText aria-hidden />
            <div><p>ردیف‌های اسناد قطعی به‌ترتیب تاریخ و شماره</p><h3>دفتر روزنامه</h3></div>
          </header>
          {journalRows.length === 0 ? (
            <div className="empty-state">در این بازه سند قطعی وجود ندارد.</div>
          ) : (
            <>
              <div className="accounting-table-desktop table-scroll">
                <table className="journal-report-table">
                  <thead>
                    <tr>
                      <th>تاریخ</th><th>سند</th><th>حساب</th><th>طرف‌حساب</th>
                      <th>شرح</th><th>بدهکار</th><th>بستانکار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalRows.map((row) => (
                      <tr key={row.entryId + '-' + row.lineNumber}>
                        <td>{formatJalaliDate(row.entryDate)}</td>
                        <td>{row.entryNumber}</td>
                        <td><strong>{row.accountCode}</strong><small>{row.accountName}</small></td>
                        <td>{row.partyName ?? '—'}</td>
                        <td>{row.description ?? row.entryDescription}</td>
                        <td>{formatSignedIrr(row.debitIrr, amountUnit)}</td>
                        <td>{formatSignedIrr(row.creditIrr, amountUnit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="accounting-cards-mobile">
                {journalRows.map((row) => (
                  <article className="accounting-report-card" key={row.entryId + '-m-' + row.lineNumber}>
                    <header><strong>سند {row.entryNumber}</strong><span>{formatJalaliDate(row.entryDate)}</span></header>
                    <p>{row.accountCode} — {row.accountName}</p>
                    <dl>
                      <div><dt>طرف‌حساب</dt><dd>{row.partyName ?? '—'}</dd></div>
                      <div><dt>بدهکار</dt><dd>{formatSignedIrr(row.debitIrr, amountUnit)}</dd></div>
                      <div><dt>بستانکار</dt><dd>{formatSignedIrr(row.creditIrr, amountUnit)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {ledger ? (
        <div className="accounting-report-result">
          <header className="form-section-heading">
            <BookOpenText aria-hidden />
            <div>
              <p>مانده ابتدای دوره در مانده جاری هر ردیف لحاظ شده است</p>
              <h3>دفتر حساب {ledger.account.code} — {ledger.account.name}</h3>
            </div>
          </header>
          <div className="ledger-opening">
            <span>مانده ابتدای دوره</span>
            <strong>{formatSignedIrr(ledger.openingBalanceIrr, amountUnit)}</strong>
          </div>
          {ledger.lines.length === 0 ? (
            <div className="empty-state">در این بازه گردش جدیدی برای حساب وجود ندارد.</div>
          ) : (
            <>
              <div className="accounting-table-desktop table-scroll">
                <table className="ledger-report-table">
                  <thead>
                    <tr>
                      <th>تاریخ</th><th>سند</th><th>ارجاع</th><th>طرف‌حساب</th>
                      <th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.lines.map((line, index) => (
                      <tr key={line.entryId + '-' + index}>
                        <td>{formatJalaliDate(line.entryDate)}</td>
                        <td>{line.entryNumber}</td>
                        <td>{line.referenceNumber ?? '—'}</td>
                        <td>{line.partyName ?? '—'}</td>
                        <td>{line.description ?? line.entryDescription}</td>
                        <td>{formatSignedIrr(line.debitIrr, amountUnit)}</td>
                        <td>{formatSignedIrr(line.creditIrr, amountUnit)}</td>
                        <td>{formatSignedIrr(line.runningBalanceIrr, amountUnit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="accounting-cards-mobile">
                {ledger.lines.map((line, index) => (
                  <article className="accounting-report-card" key={line.entryId + '-ledger-' + index}>
                    <header><strong>سند {line.entryNumber}</strong><span>{formatJalaliDate(line.entryDate)}</span></header>
                    <p>{line.description ?? line.entryDescription}</p>
                    <dl>
                      <div><dt>بدهکار</dt><dd>{formatSignedIrr(line.debitIrr, amountUnit)}</dd></div>
                      <div><dt>بستانکار</dt><dd>{formatSignedIrr(line.creditIrr, amountUnit)}</dd></div>
                      <div><dt>مانده</dt><dd>{formatSignedIrr(line.runningBalanceIrr, amountUnit)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
