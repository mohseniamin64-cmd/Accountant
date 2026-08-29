/**
 * Persian Number to Words Converter (تبدیل عدد به حروف فارسی)
 * Handles numbers up to trillions with high accuracy for accounting and official invoicing.
 */

const yekan: string[] = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const dahgan10: string[] = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const dahgan: string[] = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const sadgan: string[] = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const steps: string[] = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

function chunkNumber(num: number): number[] {
  const chunks: number[] = [];
  let n = Math.abs(num);
  while (n > 0) {
    chunks.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  return chunks;
}

function threeDigitToWords(num: number): string {
  if (num === 0) return '';
  const sad = Math.floor(num / 100);
  const rem = num % 100;
  const dah = Math.floor(rem / 10);
  const yek = rem % 10;

  const parts: string[] = [];

  if (sad > 0) {
    parts.push(sadgan[sad]);
  }

  if (rem >= 10 && rem < 20) {
    parts.push(dahgan10[rem - 10]);
  } else {
    if (dah > 0) parts.push(dahgan[dah]);
    if (yek > 0) parts.push(yekan[yek]);
  }

  return parts.filter(Boolean).join(' و ');
}

export function numberToPersianWords(num: number | string): string {
  if (typeof num === 'string') {
    const clean = num.replace(/[^\d-]/g, '');
    num = parseInt(clean, 10);
  }

  if (isNaN(num) || num === 0) {
    return 'صفر';
  }

  const isNegative = num < 0;
  const chunks = chunkNumber(num);
  const resultParts: string[] = [];

  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk > 0) {
      const words = threeDigitToWords(chunk);
      const step = steps[i];
      resultParts.push(step ? `${words} ${step}` : words);
    }
  }

  const output = (isNegative ? 'منفی ' : '') + resultParts.join(' و ');
  return output;
}

export function amountToTomanWords(amount: number | string): string {
  const words = numberToPersianWords(amount);
  if (words === 'صفر') return 'صفر تومان';
  return `${words} تومان`;
}
