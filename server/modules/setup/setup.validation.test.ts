import {describe, expect, it} from 'vitest';
import {setupSchema} from './routes.js';

function validSetup() {
  return {
    companyName: 'دیاکو الکترونیکس',
    companyEnglishName: 'Diaco Electronics',
    branchName: 'شعبه اصلی',
    adminFullName: 'مدیر سامانه',
    adminUsername: 'admin',
    adminPassword: 'SecurePass1',
    defaultAmountUnit: 'IRR' as const,
    fiscalYearTitle: 'سال مالی ۱۴۰۵',
    fiscalYearStartsOn: '2026-03-21',
    fiscalYearEndsOn: '2027-03-20',
  };
}

describe('initial setup validation', () => {
  it('accepts a complete valid setup request', () => {
    expect(setupSchema.safeParse(validSetup()).success).toBe(true);
  });

  it('rejects a Persian username with a precise message', () => {
    const result = setupSchema.safeParse({
      ...validSetup(),
      adminUsername: 'مدیر',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.adminUsername).toContain(
      'نام کاربری فقط باید شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.',
    );
  });

  it('rejects a weak password with a precise message', () => {
    const result = setupSchema.safeParse({
      ...validSetup(),
      adminPassword: 'weakpassword',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.adminPassword).toContain(
      'رمز عبور باید حداقل ۱۰ نویسه و شامل حروف بزرگ انگلیسی، حروف کوچک انگلیسی و عدد باشد.',
    );
  });

  it('rejects a fiscal year ending before its start', () => {
    const result = setupSchema.safeParse({
      ...validSetup(),
      fiscalYearEndsOn: '2026-03-20',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.fiscalYearEndsOn).toContain(
      'تاریخ پایان سال مالی باید بعد از تاریخ شروع باشد.',
    );
  });
});
