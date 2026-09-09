const DAY_MS = 86_400_000;
const NOON_MS = 43_200_000;
const MIN_GREGORIAN_DAY = Math.floor(Date.UTC(1800, 0, 1) / DAY_MS);
const MAX_GREGORIAN_DAY = Math.floor(Date.UTC(2400, 11, 31) / DAY_MS);

const persianCalendarParts = new Intl.DateTimeFormat(
  'en-US-u-ca-persian-nu-latn',
  {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  },
);

const persianDateDisplay = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeZone: 'Asia/Tehran',
});

const persianDateTimeDisplay = new Intl.DateTimeFormat(
  'fa-IR-u-ca-persian',
  {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  },
);

const persianDigits = '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9';
const arabicDigits = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

export function normalizeDateDigits(value: string): string {
  return value
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[\u0660-\u0669]/g, (digit) => String(arabicDigits.indexOf(digit)));
}

export function toPersianDateDigits(value: string): string {
  return value.replace(/\d/g, (digit) => persianDigits[Number(digit)] ?? digit);
}

export function jalaliPartsToInput(parts: JalaliDateParts): string {
  const ascii = [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('/');
  return toPersianDateDigits(ascii);
}

export function getCurrentJalaliDateParts(now = new Date()): JalaliDateParts {
  const parts = persianCalendarParts.formatToParts(now);
  const read = (type: 'year' | 'month' | 'day'): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error('Persian calendar is unavailable.');
    return Number(value);
  };
  return {year: read('year'), month: read('month'), day: read('day')};
}

function jalaliPartsForDay(gregorianDay: number): JalaliDateParts {
  const date = new Date(gregorianDay * DAY_MS + NOON_MS);
  const parts = persianCalendarParts.formatToParts(date);
  const read = (type: 'year' | 'month' | 'day'): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error('Persian calendar is unavailable.');
    return Number(value);
  };
  return {year: read('year'), month: read('month'), day: read('day')};
}

function dateKey(parts: JalaliDateParts): number {
  return parts.year * 10_000 + parts.month * 100 + parts.day;
}

export function parseJalaliDateInput(value: string): JalaliDateParts {
  const normalized = normalizeDateDigits(value)
    .trim()
    .replace(/[\u066b.\-]/g, '/')
    .replace(/\s/g, '');
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) {
    throw new Error(
      '\u062a\u0627\u0631\u06cc\u062e \u0631\u0627 \u0628\u0647 \u0634\u06a9\u0644 \u0634\u0645\u0633\u06cc \u0645\u062b\u0644 \u06f1\u06f4\u06f0\u06f5/\u06f0\u06f6/\u06f0\u06f9 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f.',
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1200 || year > 1700 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('\u062a\u0627\u0631\u06cc\u062e \u0634\u0645\u0633\u06cc \u0648\u0627\u0631\u062f\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
  }
  return {year, month, day};
}

export function jalaliInputToIso(value: string): string {
  const target = parseJalaliDateInput(value);
  const targetKey = dateKey(target);
  let low = MIN_GREGORIAN_DAY;
  let high = MAX_GREGORIAN_DAY;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const currentKey = dateKey(jalaliPartsForDay(middle));
    if (currentKey === targetKey) {
      return new Date(middle * DAY_MS).toISOString().slice(0, 10);
    }
    if (currentKey < targetKey) low = middle + 1;
    else high = middle - 1;
  }

  throw new Error('\u062a\u0627\u0631\u06cc\u062e \u0634\u0645\u0633\u06cc \u0648\u0627\u0631\u062f\u0634\u062f\u0647 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a.');
}

export function getJalaliMonthLength(year: number, month: number): number {
  if (!Number.isInteger(year) || year < 1200 || year > 1700) {
    throw new Error('سال شمسی معتبر نیست.');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('ماه شمسی معتبر نیست.');
  }
  for (let day = 31; day >= 29; day -= 1) {
    try {
      jalaliInputToIso(year + '/' + month + '/' + day);
      return day;
    } catch {
      // روزهای نامعتبر انتهای ماه بررسی نمی‌شوند.
    }
  }
  throw new Error('طول ماه شمسی قابل محاسبه نیست.');
}

export function getJalaliMonthStartWeekday(year: number, month: number): number {
  const iso = jalaliInputToIso(year + '/' + month + '/1');
  const gregorianWeekday = new Date(iso + 'T00:00:00Z').getUTCDay();
  return (gregorianWeekday + 1) % 7;
}

function isoDateToDate(value: string): Date {
  const normalized = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Invalid internal ISO date.');
  }
  const date = new Date(normalized + 'T12:00:00Z');
  if (Number.isNaN(date.getTime())) throw new Error('Invalid internal ISO date.');
  return date;
}

export function isoDateToJalaliInput(value: string): string {
  const date = isoDateToDate(value);
  const parts = jalaliPartsForDay(Math.floor(date.getTime() / DAY_MS));
  const ascii = [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('/');
  return toPersianDateDigits(ascii);
}

export function formatJalaliDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  try {
    const source = String(value);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(source.slice(0, 10))
      ? isoDateToDate(source)
      : new Date(source);
    if (Number.isNaN(date.getTime())) return source;
    return persianDateDisplay.format(date);
  } catch {
    return String(value);
  }
}

export function formatJalaliDateTime(value: unknown): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return persianDateTimeDisplay.format(date);
}
