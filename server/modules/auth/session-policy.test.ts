import {describe, expect, it} from 'vitest';
import {sessionSecuritySchema} from './session-policy.js';

describe('session security settings', () => {
  it('applies safe defaults for new and legacy settings', () => {
    expect(sessionSecuritySchema.parse({})).toEqual({
      idleMinutes: 30,
      loginLockEnabled: true,
      maxFailedLoginAttempts: 5,
      loginLockMinutes: 15,
    });
  });

  it('rejects unsafe lock ranges', () => {
    expect(() => sessionSecuritySchema.parse({
      idleMinutes: 30,
      loginLockEnabled: true,
      maxFailedLoginAttempts: 0,
      loginLockMinutes: 15,
    })).toThrow();
    expect(() => sessionSecuritySchema.parse({
      idleMinutes: 30,
      loginLockEnabled: true,
      maxFailedLoginAttempts: 5,
      loginLockMinutes: 1441,
    })).toThrow();
  });
});