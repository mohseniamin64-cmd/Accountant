import {describe, expect, it} from 'vitest';
import {describeDevice, isSessionOnline, ONLINE_WINDOW_MS} from './session-state.js';

describe('session state', () => {
  it('expires online state after the heartbeat window', () => {
    const now = new Date('2026-09-22T10:00:00.000Z');
    expect(isSessionOnline(new Date(now.getTime() - ONLINE_WINDOW_MS + 1), now)).toBe(true);
    expect(isSessionOnline(new Date(now.getTime() - ONLINE_WINDOW_MS - 1), now)).toBe(false);
  });

  it('creates a non-sensitive device label', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0')).toBe('Chrome / Windows');
    expect(describeDevice(null)).toBe('مرورگر ناشناس / دستگاه ناشناس');
  });
});
