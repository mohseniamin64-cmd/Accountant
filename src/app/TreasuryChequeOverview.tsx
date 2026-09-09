import {useMemo} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import type {TreasuryCheque} from './TreasuryHistory.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {
  summarizeCheques,
  type ChequeSummaryMetric,
} from './treasury.cheque-summary.js';
import './treasury-cheque-overview.css';

interface TreasuryChequeOverviewProps {
  amountUnit: AmountUnit;
  cheques: readonly TreasuryCheque[];
}

interface OverviewCard {
  key: string;
  title: string;
  description: string;
  tone: 'warning' | 'info' | 'danger' | 'neutral';
  metric: ChequeSummaryMetric;
}

function todayInTehran(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatAmount(value: string, unit: AmountUnit): string {
  const irr = BigInt(value);
  if (unit === 'IRR') {
    return irr.toLocaleString('fa-IR') + ' \u0631\u06cc\u0627\u0644';
  }
  const whole = irr / 10n;
  const fraction = irr % 10n;
  const shown =
    fraction === 0n
      ? whole.toLocaleString('fa-IR')
      : whole.toLocaleString('fa-IR') +
        '\u066b' +
        fraction.toLocaleString('fa-IR');
  return shown + ' \u062a\u0648\u0645\u0627\u0646';
}

export function TreasuryChequeOverview({
  amountUnit,
  cheques,
}: TreasuryChequeOverviewProps) {
  const today = todayInTehran();
  const summary = useMemo(
    () => summarizeCheques(cheques, today),
    [cheques, today],
  );
  const cards: readonly OverviewCard[] = [
    {
      key: 'overdue-receivable',
      title: '\u062f\u0631\u06cc\u0627\u0641\u062a\u0646\u06cc \u0633\u0631\u0631\u0633\u06cc\u062f \u06af\u0630\u0634\u062a\u0647',
      description: '\u0686\u06a9\u200c\u0647\u0627\u06cc \u0648\u0635\u0648\u0644\u200c\u0646\u0634\u062f\u0647 \u0628\u0627 \u062a\u0627\u0631\u06cc\u062e \u06af\u0630\u0634\u062a\u0647',
      tone: 'warning',
      metric: summary.overdueReceivable,
    },
    {
      key: 'due-soon-receivable',
      title: '\u062f\u0631\u06cc\u0627\u0641\u062a\u0646\u06cc \u0647\u0641\u062a \u0631\u0648\u0632 \u0622\u06cc\u0646\u062f\u0647',
      description: '\u0627\u0632 \u0627\u0645\u0631\u0648\u0632 \u062a\u0627 \u067e\u0627\u06cc\u0627\u0646 \u0631\u0648\u0632 \u0647\u0641\u062a\u0645',
      tone: 'info',
      metric: summary.dueSoonReceivable,
    },
    {
      key: 'bounced-receivable',
      title: '\u0686\u06a9\u200c\u0647\u0627\u06cc \u0628\u0631\u06af\u0634\u062a\u06cc \u0628\u0627\u0632',
      description: '\u0646\u06cc\u0627\u0632\u0645\u0646\u062f \u067e\u06cc\u06af\u06cc\u0631\u06cc \u06cc\u0627 \u0648\u0627\u06af\u0630\u0627\u0631\u06cc \u0645\u062c\u062f\u062f',
      tone: 'danger',
      metric: summary.bouncedReceivable,
    },
    {
      key: 'due-soon-payable',
      title: '\u067e\u0631\u062f\u0627\u062e\u062a\u0646\u06cc \u0647\u0641\u062a \u0631\u0648\u0632 \u0622\u06cc\u0646\u062f\u0647',
      description: '\u0686\u06a9\u200c\u0647\u0627\u06cc \u0635\u0627\u062f\u0631\u0634\u062f\u0647 \u0646\u0632\u062f\u06cc\u06a9 \u0628\u0647 \u0633\u0631\u0631\u0633\u06cc\u062f',
      tone: 'neutral',
      metric: summary.dueSoonPayable,
    },
  ];

  return (
    <section
      className="treasury-cheque-overview"
      aria-label={'\u062e\u0644\u0627\u0635\u0647 \u0633\u0631\u0631\u0633\u06cc\u062f \u0686\u06a9\u200c\u0647\u0627'}
    >
      <div className="treasury-cheque-overview-heading">
        <ContextHelpButton help={appHelp.treasuryChequeOverview} />
        <div>
          <h2>{'\u067e\u06cc\u06af\u06cc\u0631\u06cc \u0633\u0631\u0631\u0633\u06cc\u062f \u0686\u06a9\u200c\u0647\u0627'}</h2>
          <p>{'\u0627\u0639\u062f\u0627\u062f \u0645\u0633\u062a\u0642\u06cc\u0645\u0627\u064b \u0627\u0632 \u0686\u06a9\u200c\u0647\u0627\u06cc \u062b\u0628\u062a\u200c\u0634\u062f\u0647 \u0641\u0639\u0644\u06cc \u0645\u062d\u0627\u0633\u0628\u0647 \u0645\u06cc\u200c\u0634\u0648\u0646\u062f.'}</p>
        </div>
      </div>
      <div className="treasury-cheque-overview-grid">
        {cards.map((card) => (
          <article
            className={'treasury-cheque-overview-card tone-' + card.tone}
            key={card.key}
          >
            <div className="treasury-cheque-overview-card-heading">
              <strong>{card.title}</strong>
              <span>
                {card.metric.count.toLocaleString('fa-IR')}
                {' \u0641\u0642\u0631\u0647'}
              </span>
            </div>
            <b>{formatAmount(card.metric.totalIrr, amountUnit)}</b>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
