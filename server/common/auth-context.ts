import type {Request} from 'express';
import type {AuthenticatedUser} from '../../shared/contracts.js';
import {AppError} from './errors.js';

export function currentUser(request: Request): AuthenticatedUser {
  if (!request.auth) {
    throw new AppError(
      401,
      'AUTHENTICATION_REQUIRED',
      'برای ادامه باید وارد سامانه شوید.',
    );
  }
  return request.auth;
}
