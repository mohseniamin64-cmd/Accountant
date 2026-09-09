import type {
  ApiErrorBody,
  ApiSuccess,
  BootstrapResponse,
} from '../../shared/contracts.js';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError(
      response.status,
      'INVALID_API_RESPONSE',
      '\u067e\u0627\u0633\u062e \u0633\u0631\u0648\u0631 \u0645\u0639\u062a\u0628\u0631 \u0646\u06cc\u0633\u062a. \u0628\u0631\u0646\u0627\u0645\u0647 \u0628\u0627\u06cc\u062f \u0627\u0632 \u0637\u0631\u06cc\u0642 \u0633\u0631\u0648\u0631 \u0627\u0635\u0644\u06cc \u0627\u062c\u0631\u0627 \u0634\u0648\u062f.',
      {contentType},
    );
  }
  const body = (await response.json()) as ApiSuccess<T> | ApiErrorBody;
  if (!response.ok || 'error' in body) {
    const error = 'error' in body ? body.error : null;
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? '\u0627\u0631\u062a\u0628\u0627\u0637 \u0628\u0627 \u0633\u0631\u0648\u0631 \u0628\u0627 \u062e\u0637\u0627 \u0631\u0648\u0628\u0647\u200c\u0631\u0648 \u0634\u062f.',
      error?.details,
    );
  }
  return body.data;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
  return parseResponse<T>(response);
}

export function getBootstrap(): Promise<BootstrapResponse> {
  return api<BootstrapResponse>('/api/bootstrap');
}

export function postJson<T>(
  path: string,
  body: unknown,
  method: 'POST' | 'PUT' | 'PATCH' = 'POST',
): Promise<T> {
  return api<T>(path, {method, body: JSON.stringify(body)});
}

const validationFieldLabels: Record<string, string> = {
  companyName: 'نام شرکت یا کارگاه',
  companyEnglishName: 'نام انگلیسی',
  branchName: 'نام شعبه اصلی',
  adminFullName: 'نام و نام خانوادگی مدیر',
  adminUsername: 'نام کاربری',
  adminPassword: 'رمز عبور',
  defaultAmountUnit: 'واحد نمایش',
  fiscalYearTitle: 'عنوان سال مالی',
  fiscalYearStartsOn: 'تاریخ شروع سال مالی',
  fiscalYearEndsOn: 'تاریخ پایان سال مالی',
};

function validationMessage(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const fieldErrors = Reflect.get(details, 'fieldErrors');
  if (fieldErrors && typeof fieldErrors === 'object') {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (!Array.isArray(messages)) continue;
      const message = messages.find(
        (item): item is string => typeof item === 'string' && item.length > 0,
      );
      if (message) {
        const label = validationFieldLabels[field];
        return label ? label + ': ' + message : message;
      }
    }
  }
  const formErrors = Reflect.get(details, 'formErrors');
  if (Array.isArray(formErrors)) {
    const message = formErrors.find(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );
    if (message) return message;
  }
  return null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR') {
      return validationMessage(error.details) ?? error.message;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد.';
}
