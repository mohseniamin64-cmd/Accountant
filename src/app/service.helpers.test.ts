import {describe, expect, it} from 'vitest';
import {
  allowedServiceTransitions,
  nonNegativeServiceAmount,
  positiveServiceQuantity,
  serviceRemainingIrr,
  serviceStatusText,
} from './service.helpers.js';

describe('service helpers', () => {
  it('keeps the workflow transitions explicit', () => {
    expect(allowedServiceTransitions('received')).toEqual([
      'diagnosis',
      'cancelled',
    ]);
    expect(allowedServiceTransitions('delivered')).toEqual([]);
  });

  it('uses Persian operational status labels', () => {
    expect(serviceStatusText('ready_delivery')).toBe('آماده تحویل');
  });

  it('converts the user amount unit to IRR', () => {
    expect(nonNegativeServiceAmount('1,250', 'TOMAN', 'هزینه')).toBe('12500');
    expect(nonNegativeServiceAmount('1250', 'IRR', 'هزینه')).toBe('1250');
  });

  it('validates positive service quantities', () => {
    expect(positiveServiceQuantity('2.500000')).toBe('2.5');
    expect(() => positiveServiceQuantity('0')).toThrow();
    expect(() => positiveServiceQuantity('1.0000001')).toThrow();
  });

  it('never returns a negative remaining amount', () => {
    expect(serviceRemainingIrr('5000', '1200')).toBe(3800n);
    expect(serviceRemainingIrr('5000', '6000')).toBe(0n);
  });
});
