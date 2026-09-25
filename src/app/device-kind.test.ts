import {describe, expect, it} from 'vitest';
import {detectDeviceKind} from './device-kind.js';

describe('scanner device selection', () => {
  it.each([
    ['Mozilla/5.0 (Linux; Android 14) Chrome Mobile', 'Linux armv8l', 5, 'mobile'],
    ['Mozilla/5.0 (Linux; Android 14) Chrome', 'Linux armv8l', 5, 'tablet'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17)', 'iPhone', 5, 'mobile'],
    ['Mozilla/5.0 (iPad; CPU OS 17)', 'iPad', 5, 'tablet'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5, 'tablet'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 0, 'desktop'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0, 'desktop'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64', 0, 'desktop'],
    ['', '', 0, 'unknown'],
    ['unrecognized device', '', 5, 'unknown'],
  ])('classifies %s', (userAgent, platform, maxTouchPoints, expected) => {
    expect(detectDeviceKind({userAgent, platform, maxTouchPoints})).toBe(expected);
  });

  it('uses an explicit mobile client hint', () => {
    expect(detectDeviceKind({userAgent: '', platform: '', maxTouchPoints: 0,
      userAgentData: {mobile: true}})).toBe('mobile');
  });
});
