import {describe, expect, it} from 'vitest';
import {ApiError, errorMessage} from './api.js';

describe('API validation messages', () => {
  it('shows the first field-specific validation error in Persian', () => {
    const error = new ApiError(
      422,
      'VALIDATION_ERROR',
      'اطلاعات ارسالی معتبر نیست.',
      {
        fieldErrors: {
          adminPassword: [
            'رمز عبور باید حداقل ۱۰ نویسه و شامل حروف بزرگ انگلیسی، حروف کوچک انگلیسی و عدد باشد.',
          ],
        },
        formErrors: [],
      },
    );

    expect(errorMessage(error)).toBe(
      'رمز عبور: رمز عبور باید حداقل ۱۰ نویسه و شامل حروف بزرگ انگلیسی، حروف کوچک انگلیسی و عدد باشد.',
    );
  });

  it('keeps ordinary API errors unchanged', () => {
    const error = new ApiError(401, 'UNAUTHORIZED', 'نام کاربری یا رمز عبور نادرست است.');

    expect(errorMessage(error)).toBe('نام کاربری یا رمز عبور نادرست است.');
  });
});
