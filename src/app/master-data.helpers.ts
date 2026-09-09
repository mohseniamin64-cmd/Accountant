import type {AmountUnit} from '../../shared/contracts.js';

export type ActiveFilter = 'true' | 'false' | 'all';

export function normalizeNumericInput(value: string): string {
  return value
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660))
    .replace(/\u066b/g, '.')
    .replace(/[\u066c,]/g, '');
}

export function nullableText(value: FormDataEntryValue | null): string | null {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? null : normalized;
}

export function amountInputToIrr(value: string, unit: AmountUnit): string {
  const normalized = normalizeNumericInput(value).trim();
  if (unit === 'IRR') {
    if (!/^[0-9]+$/.test(normalized)) {
      throw new Error('\u0645\u0628\u0644\u063a \u0631\u06cc\u0627\u0644\u06cc \u0628\u0627\u06cc\u062f \u0639\u062f\u062f \u0635\u062d\u06cc\u062d \u0648 \u0646\u0627\u0645\u0646\u0641\u06cc \u0628\u0627\u0634\u062f.');
    }
    return BigInt(normalized).toString();
  }
  if (!/^[0-9]+(?:\.[0-9])?$/.test(normalized)) {
    throw new Error('\u0645\u0628\u0644\u063a \u062a\u0648\u0645\u0627\u0646\u06cc \u0628\u0627\u06cc\u062f \u0646\u0627\u0645\u0646\u0641\u06cc \u0648 \u062d\u062f\u0627\u06a9\u062b\u0631 \u06cc\u06a9 \u0631\u0642\u0645 \u0627\u0639\u0634\u0627\u0631 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.');
  }
  const [whole = '0', fraction = '0'] = normalized.split('.');
  return (BigInt(whole) * 10n + BigInt(fraction)).toString();
}

export function amountIrrToInput(value: string, unit: AmountUnit): string {
  const irr = BigInt(value || '0');
  if (unit === 'IRR') return irr.toString();
  const whole = irr / 10n;
  const fraction = irr % 10n;
  return fraction === 0n ? whole.toString() : whole.toString() + '.' + fraction.toString();
}

export function nonNegativeQuantity(value: string): string {
  const normalized = normalizeNumericInput(value).trim();
  if (!/^[0-9]+(?:\.[0-9]{1,6})?$/.test(normalized)) {
    throw new Error('\u0645\u0642\u062f\u0627\u0631 \u0628\u0627\u06cc\u062f \u0639\u062f\u062f\u06cc \u0646\u0627\u0645\u0646\u0641\u06cc \u0628\u0627 \u062d\u062f\u0627\u06a9\u062b\u0631 \u0634\u0634 \u0631\u0642\u0645 \u0627\u0639\u0634\u0627\u0631 \u0628\u0627\u0634\u062f.');
  }
  return normalized;
}

export function buildListPath(
  base: string,
  query: string,
  active: ActiveFilter,
  offset: number,
  limit: number,
): string {
  const params = new URLSearchParams({
    q: query.trim(),
    active,
    offset: String(offset),
    limit: String(limit),
  });
  return base + '?' + params.toString();
}
