import {
  BadgeCheck,
  CircleAlert,
  Scale,
  TrendingUp,
} from 'lucide-react';
import type {AmountUnit} from '../../shared/contracts.js';
import {formatSignedIrr} from './accounting.helpers.js';
import type {
  BalanceSheetReport,
  FinancialStatementLine,
  ProfitLossReport,
} from './accounting.types.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {formatJalaliDate} from './jalali-date.js';

interface StatementSectionProps {
  amountUnit: AmountUnit;
  lines: readonly FinancialStatementLine[];
  title: string;
  totalIrr: string;
  totalLabel: string;
  tone: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
}

function StatementSection({
  amountUnit,
  lines,
  title,
  totalIrr,
  totalLabel,
  tone,
}: StatementSectionProps) {
  return (
    <section className={'financial-statement-block statement-' + tone}>
      <h4>{title}</h4>
      {lines.length === 0 ? (
        <p className="financial-statement-empty">
          تا تاریخ انتخاب‌شده مانده‌ای در این بخش ثبت نشده است.
        </p>
      ) : (
        <>
          <div className="accounting-table-desktop table-scroll">
            <table className="financial-statement-table">
              <thead>
                <tr>
                  <th>کد حساب</th>
                  <th>عنوان حساب</th>
                  <th>مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.accountId}>
                    <td>{line.accountCode}</td>
                    <td>{line.accountName}</td>
                    <td>{formatSignedIrr(line.amountIrr, amountUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="financial-statement-cards">
            {lines.map((line) => (
              <article key={line.accountId}>
                <span>{line.accountCode}</span>
                <strong>{line.accountName}</strong>
                <b>{formatSignedIrr(line.amountIrr, amountUnit)}</b>
              </article>
            ))}
          </div>
        </>
      )}
      <footer>
        <span>{totalLabel}</span>
        <strong>{formatSignedIrr(totalIrr, amountUnit)}</strong>
      </footer>
    </section>
  );
}

interface ProfitLossProps {
  amountUnit: AmountUnit;
  report: ProfitLossReport;
}

export function ProfitLossStatement({amountUnit, report}: ProfitLossProps) {
  const profitable = BigInt(report.netProfitIrr) >= 0n;
  return (
    <section className="accounting-report-result financial-statement-result">
      <header className="form-section-heading financial-statement-heading">
        <ContextHelpButton help={appHelp.accountingProfitLoss} />
        <TrendingUp aria-hidden />
        <div>
          <p>
            از {formatJalaliDate(report.from)} تا {formatJalaliDate(report.to)}
          </p>
          <h3>صورت سود و زیان</h3>
        </div>
      </header>
      <div className="financial-statement-grid profit-loss-grid">
        <StatementSection
          amountUnit={amountUnit}
          lines={report.incomeLines}
          title="درآمدها"
          totalIrr={report.totalIncomeIrr}
          totalLabel="جمع درآمدها"
          tone="income"
        />
        <StatementSection
          amountUnit={amountUnit}
          lines={report.expenseLines}
          title="هزینه‌ها"
          totalIrr={report.totalExpenseIrr}
          totalLabel="جمع هزینه‌ها"
          tone="expense"
        />
      </div>
      <div className={'financial-statement-net ' + (profitable ? 'is-profit' : 'is-loss')}>
        <span>{profitable ? 'سود خالص دوره' : 'زیان خالص دوره'}</span>
        <strong>{formatSignedIrr(report.netProfitIrr, amountUnit)}</strong>
      </div>
    </section>
  );
}

interface BalanceSheetProps {
  amountUnit: AmountUnit;
  report: BalanceSheetReport;
}

export function BalanceSheetStatement({
  amountUnit,
  report,
}: BalanceSheetProps) {
  const equityLines: FinancialStatementLine[] = [
    ...report.equityLines,
    {
      accountId: 'unclosed-earnings',
      accountCode: '—',
      accountName: 'سود (زیان) حساب‌های موقتِ بسته‌نشده',
      amountIrr: report.unclosedEarningsIrr,
    },
  ];
  return (
    <section className="accounting-report-result financial-statement-result">
      <header className="form-section-heading financial-statement-heading">
        <ContextHelpButton help={appHelp.accountingBalanceSheet} />
        <Scale aria-hidden />
        <div>
          <p>مانده تجمعی تا {formatJalaliDate(report.asOf)}</p>
          <h3>ترازنامه</h3>
        </div>
      </header>
      <div className="financial-statement-grid balance-sheet-grid">
        <StatementSection
          amountUnit={amountUnit}
          lines={report.assetLines}
          title="دارایی‌ها"
          totalIrr={report.totalAssetsIrr}
          totalLabel="جمع دارایی‌ها"
          tone="asset"
        />
        <StatementSection
          amountUnit={amountUnit}
          lines={report.liabilityLines}
          title="بدهی‌ها"
          totalIrr={report.totalLiabilitiesIrr}
          totalLabel="جمع بدهی‌ها"
          tone="liability"
        />
        <StatementSection
          amountUnit={amountUnit}
          lines={equityLines}
          title="حقوق مالکانه"
          totalIrr={report.totalEquityIrr}
          totalLabel="جمع حقوق مالکانه"
          tone="equity"
        />
      </div>
      <div
        className={
          'balance-sheet-equation ' +
          (report.isBalanced ? 'is-balanced' : 'is-unbalanced')
        }
        role={report.isBalanced ? 'status' : 'alert'}
      >
        {report.isBalanced ? <BadgeCheck aria-hidden /> : <CircleAlert aria-hidden />}
        <div>
          <span>
            دارایی‌ها در برابر بدهی‌ها و حقوق مالکانه
          </span>
          <strong>
            {formatSignedIrr(report.totalAssetsIrr, amountUnit)}
            {' = '}
            {formatSignedIrr(report.liabilitiesAndEquityIrr, amountUnit)}
          </strong>
          {!report.isBalanced ? (
            <small>
              اختلاف معادله: {formatSignedIrr(report.differenceIrr, amountUnit)}
            </small>
          ) : null}
        </div>
      </div>
    </section>
  );
}
