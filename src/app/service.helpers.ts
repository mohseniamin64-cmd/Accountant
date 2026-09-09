import Decimal from 'decimal.js';
import type {AmountUnit} from '../../shared/contracts.js';
import {amountInputToIrr, normalizeNumericInput} from './master-data.helpers.js';
import type {
  EstimateStatus,
  RemovedDisposition,
  ServiceStatus,
  WarrantyDecision,
} from './service.types.js';

export const serviceStatusOrder: readonly ServiceStatus[] = [
  'received',
  'diagnosis',
  'waiting_customer',
  'waiting_part',
  'repairing',
  'final_test',
  'ready_delivery',
  'delivered',
  'cancelled',
];

const transitionMap: Readonly<Record<ServiceStatus, readonly ServiceStatus[]>> = {
  received: ['diagnosis', 'cancelled'],
  diagnosis: ['waiting_customer', 'waiting_part', 'repairing', 'cancelled'],
  waiting_customer: ['diagnosis', 'repairing', 'cancelled'],
  waiting_part: ['repairing', 'cancelled'],
  repairing: ['waiting_part', 'final_test'],
  final_test: ['repairing'],
  ready_delivery: [],
  delivered: [],
  cancelled: [],
};

export function serviceStatusText(status: ServiceStatus): string {
  const labels: Record<ServiceStatus, string> = {
    received: 'پذیرش‌شده',
    diagnosis: 'در حال عیب‌یابی',
    waiting_customer: 'منتظر پاسخ مشتری',
    waiting_part: 'منتظر قطعه',
    repairing: 'در حال تعمیر',
    final_test: 'آزمون نهایی',
    ready_delivery: 'آماده تحویل',
    delivered: 'تحویل‌شده',
    cancelled: 'لغوشده',
  };
  return labels[status];
}

export function warrantyDecisionText(value: WarrantyDecision): string {
  const labels: Record<WarrantyDecision, string> = {
    pending: 'در انتظار بررسی',
    in_warranty: 'تحت گارانتی',
    out_of_warranty: 'خارج از گارانتی',
    rejected: 'گارانتی رد شده',
  };
  return labels[value];
}

export function estimateStatusText(value: EstimateStatus): string {
  const labels: Record<EstimateStatus, string> = {
    not_required: 'نیاز ندارد',
    pending: 'منتظر پاسخ',
    approved: 'تأییدشده',
    rejected: 'ردشده',
  };
  return labels[value];
}

export function removedDispositionText(value: RemovedDisposition): string {
  const labels: Record<RemovedDisposition, string> = {
    returned_customer: 'تحویل به مشتری',
    supplier_warranty: 'گارانتی تأمین‌کننده',
    repaired_reused: 'تعمیر و استفاده مجدد',
    scrapped: 'اسقاط',
  };
  return labels[value];
}

export function allowedServiceTransitions(
  status: ServiceStatus,
): readonly ServiceStatus[] {
  return transitionMap[status];
}

export function nonNegativeServiceAmount(
  value: string,
  unit: AmountUnit,
  label: string,
): string {
  try {
    const irr = amountInputToIrr(value.trim() || '0', unit);
    if (new Decimal(irr).isNegative()) {
      throw new Error(label + ' نمی‌تواند منفی باشد.');
    }
    return irr;
  } catch {
    throw new Error(label + ' باید یک مبلغ نامنفی معتبر باشد.');
  }
}

export function positiveServiceQuantity(value: string): string {
  const normalized = normalizeNumericInput(value).trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) {
    throw new Error('تعداد قطعه باید عددی با حداکثر شش رقم اعشار باشد.');
  }
  if (!new Decimal(normalized).greaterThan(0)) {
    throw new Error('تعداد قطعه باید بزرگ‌تر از صفر باشد.');
  }
  return new Decimal(normalized).toFixed();
}

export function serviceRemainingIrr(
  finalCostIrr: string,
  paidIrr: string,
): bigint {
  const remaining = BigInt(finalCostIrr || '0') - BigInt(paidIrr || '0');
  return remaining > 0n ? remaining : 0n;
}
