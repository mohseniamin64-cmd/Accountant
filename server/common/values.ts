import Decimal from 'decimal.js';
import {z} from 'zod';
import {AppError} from './errors.js';

export const identifierSchema = z.string().uuid();

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ باید با قالب استاندارد وارد شود.');

export const nonNegativeIrrSchema = z
  .string()
  .regex(/^\d+$/, 'مبلغ باید عدد صحیح و بدون علامت باشد.');

export const positiveIrrSchema = nonNegativeIrrSchema.refine(
  (value) => BigInt(value) > 0n,
  'مبلغ باید بزرگ‌تر از صفر باشد.',
);

export const positiveQuantitySchema = z
  .string()
  .refine((value) => {
    try {
      return new Decimal(value).isPositive();
    } catch {
      return false;
    }
  }, 'مقدار باید بزرگ‌تر از صفر باشد.');

export function asBigInt(value: string, fieldName = 'مبلغ'): bigint {
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error('negative');
    return parsed;
  } catch {
    throw new AppError(
      422,
      'INVALID_AMOUNT',
      `${fieldName} باید عدد صحیح و بدون اعشار باشد.`,
    );
  }
}

export function asDecimal(
  value: string,
  fieldName = 'مقدار',
): Decimal {
  try {
    const parsed = new Decimal(value);
    if (!parsed.isFinite()) throw new Error('not finite');
    return parsed;
  } catch {
    throw new AppError(
      422,
      'INVALID_QUANTITY',
      `${fieldName} معتبر نیست.`,
    );
  }
}

export function bigintToJson(value: bigint): string {
  return value.toString();
}
