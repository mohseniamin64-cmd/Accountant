import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import {ZodError} from 'zod';

export class AppError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function asyncRoute(
  handler: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export const notFound: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      404,
      'ROUTE_NOT_FOUND',
      `مسیر ${request.method} ${request.path} پیدا نشد.`,
    ),
  );
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  if (error instanceof ZodError) {
    const details = error.flatten();
    const firstFieldMessage = Object.values(details.fieldErrors)
      .flat()
      .find((message): message is string => Boolean(message));
    const firstFormMessage = details.formErrors.find(Boolean);
    response.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message:
          firstFieldMessage ??
          firstFormMessage ??
          'اطلاعات ارسالی معتبر نیست.',
        details,
        requestId: request.requestId,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: request.requestId,
      },
    });
    return;
  }

  console.error('Unhandled request error', error);
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'خطای پیش‌بینی‌نشده‌ای رخ داد.',
      requestId: request.requestId,
    },
  });
};
