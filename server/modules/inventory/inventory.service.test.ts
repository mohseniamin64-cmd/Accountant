import Decimal from 'decimal.js';
import {describe, expect, it} from 'vitest';
import {calculateMovingAverage} from './inventory.service.js';

describe('moving weighted average', () => {
  it('recalculates average cost for an inbound purchase', () => {
    const result = calculateMovingAverage(10, 100, 5, 160);
    expect(result.newQuantity.toString()).toBe('15');
    expect(result.newAverageCost.toString()).toBe('120');
    expect(result.movementValue.toString()).toBe('800');
  });

  it('uses current average cost for an outbound movement', () => {
    const result = calculateMovingAverage(15, 120, -4, 0);
    expect(result.newQuantity.toString()).toBe('11');
    expect(result.newAverageCost.toString()).toBe('120');
    expect(result.movementUnitCost.toString()).toBe('120');
    expect(result.movementValue.toString()).toBe('-480');
  });

  it('resets average when stock reaches zero', () => {
    const result = calculateMovingAverage(2, 250, -2, 0);
    expect(result.newQuantity.equals(new Decimal(0))).toBe(true);
    expect(result.newAverageCost.equals(new Decimal(0))).toBe(true);
  });
});
