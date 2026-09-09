import type {Response} from 'express';
import {config} from '../../config.js';

export const SESSION_COOKIE = 'diaco_session';

const baseOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: config.cookieSecure,
  path: '/',
};

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(SESSION_COOKIE, token, {
    ...baseOptions,
    maxAge: config.sessionAbsoluteMs,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, baseOptions);
}
