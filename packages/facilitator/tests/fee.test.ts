import { describe, it, expect } from 'vitest';
import { calculateFee } from '../src/fee';

describe('calculateFee', () => {
  it('calculates 2% fee correctly', () => {
    const result = calculateFee('100000', 2); // $0.10 USDC
    expect(result.totalAmount).toBe('100000');
    expect(result.feeAmount).toBe('2000');
    expect(result.publisherAmount).toBe('98000');
    expect(result.feePercent).toBe(2);
  });

  it('calculates 0% fee', () => {
    const result = calculateFee('100000', 0);
    expect(result.feeAmount).toBe('0');
    expect(result.publisherAmount).toBe('100000');
  });

  it('calculates fee on small amounts', () => {
    const result = calculateFee('1000', 2); // $0.001 USDC
    expect(result.feeAmount).toBe('20');
    expect(result.publisherAmount).toBe('980');
  });

  it('rounds down fee on indivisible amounts', () => {
    const result = calculateFee('1', 2); // 1 unit, 2% = 0.02 → rounds to 0
    expect(result.feeAmount).toBe('0');
    expect(result.publisherAmount).toBe('1');
  });

  it('calculates fee on large amounts', () => {
    const result = calculateFee('1000000000', 3); // $1000 at 3%
    expect(result.feeAmount).toBe('30000000');
    expect(result.publisherAmount).toBe('970000000');
  });

  it('handles fractional percent (1.5%)', () => {
    const result = calculateFee('100000', 1.5);
    expect(result.feeAmount).toBe('1500');
    expect(result.publisherAmount).toBe('98500');
  });

  it('fee + publisher = total', () => {
    const amounts = ['1', '100', '10000', '999999', '1000000000'];
    const percents = [0, 1, 2, 3, 5, 10, 0.5, 1.5];

    for (const amount of amounts) {
      for (const pct of percents) {
        const result = calculateFee(amount, pct);
        const sum = BigInt(result.feeAmount) + BigInt(result.publisherAmount);
        expect(sum).toBe(BigInt(amount));
      }
    }
  });
});
