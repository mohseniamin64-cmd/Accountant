import {describe, expect, it} from 'vitest';
import {
  formatJalaliDate,
  getJalaliMonthLength,
  getJalaliMonthStartWeekday,
  isoDateToJalaliInput,
  jalaliInputToIso,
  jalaliPartsToInput,
  normalizeDateDigits,
  parseJalaliDateInput,
} from './jalali-date.js';

describe('Persian Jalali date boundary', () => {
  it('converts a known date in both directions', () => {
    expect(isoDateToJalaliInput('2026-08-31')).toBe('\u06f1\u06f4\u06f0\u06f5/\u06f0\u06f6/\u06f0\u06f9');
    expect(jalaliInputToIso('\u06f1\u06f4\u06f0\u06f5/\u06f0\u06f6/\u06f0\u06f9')).toBe('2026-08-31');
  });

  it('accepts Latin and Arabic digits and common separators', () => {
    expect(jalaliInputToIso('1405-6-9')).toBe('2026-08-31');
    expect(jalaliInputToIso('\u0661\u0664\u0660\u0665.\u0666.\u0669')).toBe('2026-08-31');
    expect(normalizeDateDigits('\u06f1\u06f4\u06f0\u06f5')).toBe('1405');
  });

  it('rejects impossible Jalali dates', () => {
    expect(() => jalaliInputToIso('1405/13/01')).toThrow(
      '\u062a\u0627\u0631\u06cc\u062e \u0634\u0645\u0633\u06cc \u0648\u0627\u0631\u062f\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
    );
    expect(() => jalaliInputToIso('1405/12/30')).toThrow(
      '\u062a\u0627\u0631\u06cc\u062e \u0634\u0645\u0633\u06cc \u0648\u0627\u0631\u062f\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.',
    );
  });

  it('builds valid month layouts for the interactive Jalali calendar', () => {
    expect(getJalaliMonthLength(1405, 6)).toBe(31);
    expect(getJalaliMonthLength(1405, 7)).toBe(30);
    expect(getJalaliMonthLength(1405, 12)).toBe(29);
    expect(getJalaliMonthStartWeekday(1405, 6)).toBeGreaterThanOrEqual(0);
    expect(getJalaliMonthStartWeekday(1405, 6)).toBeLessThanOrEqual(6);
  });

  it('formats a selected calendar day with Persian digits', () => {
    const shown = jalaliPartsToInput({year: 1405, month: 6, day: 10});
    expect(shown).toBe('۱۴۰۵/۰۶/۱۰');
    expect(parseJalaliDateInput(shown)).toEqual({
      year: 1405,
      month: 6,
      day: 10,
    });
  });

  it('formats all visible output with the Persian calendar', () => {
    const shown = formatJalaliDate('2026-08-31');
    expect(shown).toContain('\u06f1\u06f4\u06f0\u06f5');
    expect(shown).not.toContain('2026');
  });
});
