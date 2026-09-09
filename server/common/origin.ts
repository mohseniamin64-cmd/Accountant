import type {RequestHandler} from 'express';
import {AppError} from './errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const enforceSameOrigin: RequestHandler = (request, _response, next) => {
  if (SAFE_METHODS.has(request.method)) {
    next();
    return;
  }

  const fetchSite = request.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    next(
      new AppError(
        403,
        'CROSS_SITE_REQUEST_BLOCKED',
        'درخواست بدون مبدأ معتبر پذیرفته نمی‌شود.',
      ),
    );
    return;
  }

  const origin = request.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== request.get('host')) {
        next(
          new AppError(
            403,
            'ORIGIN_MISMATCH',
            'مبدأ درخواست با نشانی سامانه یکسان نیست.',
          ),
        );
        return;
      }
    } catch {
      next(new AppError(400, 'INVALID_ORIGIN', 'مبدأ درخواست معتبر نیست.'));
      return;
    }
  }

  next();
};
