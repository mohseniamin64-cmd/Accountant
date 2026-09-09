export interface SummarizableCheque {
  direction: 'receivable' | 'payable';
  status: string;
  dueDate: string;
  amountIrr: string;
}

export interface ChequeSummaryMetric {
  count: number;
  totalIrr: string;
}

export interface ChequeSummary {
  overdueReceivable: ChequeSummaryMetric;
  dueSoonReceivable: ChequeSummaryMetric;
  bouncedReceivable: ChequeSummaryMetric;
  dueSoonPayable: ChequeSummaryMetric;
}

function emptyMetric(): ChequeSummaryMetric {
  return {count: 0, totalIrr: '0'};
}

function addDays(dateKey: string, days: number): string {
  const parts = dateKey.split('-').map(Number);
  const [year, month, day] = parts;
  if (!year || !month || !day) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function increase(metric: ChequeSummaryMetric, amount: bigint): void {
  metric.count += 1;
  metric.totalIrr = (BigInt(metric.totalIrr) + amount).toString();
}

export function summarizeCheques(
  cheques: readonly SummarizableCheque[],
  today: string,
): ChequeSummary {
  const summary: ChequeSummary = {
    overdueReceivable: emptyMetric(),
    dueSoonReceivable: emptyMetric(),
    bouncedReceivable: emptyMetric(),
    dueSoonPayable: emptyMetric(),
  };
  const dueSoonLimit = addDays(today, 7);

  for (const cheque of cheques) {
    const dueDate = cheque.dueDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) continue;

    let amount: bigint;
    try {
      amount = BigInt(cheque.amountIrr);
    } catch {
      continue;
    }

    if (
      cheque.direction === 'receivable' &&
      cheque.status === 'bounced'
    ) {
      increase(summary.bouncedReceivable, amount);
      continue;
    }

    if (
      cheque.direction === 'receivable' &&
      (cheque.status === 'received' || cheque.status === 'deposited')
    ) {
      if (dueDate < today) {
        increase(summary.overdueReceivable, amount);
      } else if (dueDate <= dueSoonLimit) {
        increase(summary.dueSoonReceivable, amount);
      }
      continue;
    }

    if (
      cheque.direction === 'payable' &&
      cheque.status === 'issued' &&
      dueDate >= today &&
      dueDate <= dueSoonLimit
    ) {
      increase(summary.dueSoonPayable, amount);
    }
  }

  return summary;
}
