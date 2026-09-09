import {describe, expect, it} from 'vitest';
import {appHelp} from './help-content.js';

const requiredHelpKeys = [
  'login',
  'setup',
  'dashboard',
  'accounting',
  'treasury',
  'parties',
  'products',
  'inventory',
  'purchases',
  'sales',
  'production',
  'service',
  'reports',
  'settings',
] as const;

describe('contextual help content', () => {
  it('covers every current main workspace', () => {
    for (const key of requiredHelpKeys) {
      expect(appHelp[key].title.trim()).not.toBe('');
      expect(appHelp[key].intro.trim()).not.toBe('');
      expect(appHelp[key].items.length).toBeGreaterThan(0);
    }
  });

  it('contains no empty guidance item', () => {
    for (const help of Object.values(appHelp)) {
      expect(help.items.every((item) => item.trim().length > 0)).toBe(true);
    }
  });
});
