import {describe, expect, it} from 'vitest';
import {sanitizeAuditValue} from './audit.js';

describe('audit redaction', () => {
  it('never keeps passwords, tokens, cookies or hashes', () => {
    expect(sanitizeAuditValue({
      username: 'user',
      password: 'Pass123456',
      nested: {sessionToken: 'secret', cookie: 'x', passwordHash: 'hash'},
    })).toEqual({
      username: 'user',
      password: '[REDACTED]',
      nested: {sessionToken: '[REDACTED]', cookie: '[REDACTED]', passwordHash: '[REDACTED]'},
    });
  });
});
