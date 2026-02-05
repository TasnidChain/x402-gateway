/**
 * Tests for budget manager
 */

import { describe, it, expect, vi } from 'vitest';
import { BudgetManager } from './budget';
import { X402BudgetError } from '@x402/core';

describe('BudgetManager', () => {
  describe('checkSpend', () => {
    it('should allow spend with no limits', () => {
      const budget = new BudgetManager();
      const result = budget.checkSpend('100.00');
      expect(result.allowed).toBe(true);
    });

    it('should allow spend within per-request limit', () => {
      const budget = new BudgetManager({ maxPerRequest: '1.00' });
      const result = budget.checkSpend('0.50');
      expect(result.allowed).toBe(true);
    });

    it('should reject spend exceeding per-request limit', () => {
      const budget = new BudgetManager({ maxPerRequest: '1.00' });
      const result = budget.checkSpend('1.50');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('per-request limit');
    });

    it('should allow spend within total budget', () => {
      const budget = new BudgetManager({ maxTotal: '10.00' });
      const result = budget.checkSpend('5.00');
      expect(result.allowed).toBe(true);
    });

    it('should reject spend exceeding total budget', () => {
      const budget = new BudgetManager({ maxTotal: '10.00' });

      // Record some spending first
      budget.recordSpend('8000000', 'item-1', 'example.com'); // 8 USDC

      const result = budget.checkSpend('3.00'); // Would total 11 USDC
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('total budget');
    });

    it('should allow domain in allowlist', () => {
      const budget = new BudgetManager({
        allowedDomains: ['api.example.com', 'data.example.com'],
      });
      const result = budget.checkSpend('1.00', 'api.example.com');
      expect(result.allowed).toBe(true);
    });

    it('should reject domain not in allowlist', () => {
      const budget = new BudgetManager({
        allowedDomains: ['api.example.com'],
      });
      const result = budget.checkSpend('1.00', 'evil.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in the allowed list');
    });

    it('should skip domain check if no allowlist configured', () => {
      const budget = new BudgetManager({});
      const result = budget.checkSpend('1.00', 'any-domain.com');
      expect(result.allowed).toBe(true);
    });

    it('should skip domain check if no domain provided', () => {
      const budget = new BudgetManager({
        allowedDomains: ['api.example.com'],
      });
      const result = budget.checkSpend('1.00');
      expect(result.allowed).toBe(true);
    });
  });

  describe('recordSpend', () => {
    it('should track spending correctly', () => {
      const budget = new BudgetManager({ maxTotal: '10.00' });

      budget.recordSpend('1000000', 'item-1', 'example.com'); // 1 USDC
      budget.recordSpend('2000000', 'item-2', 'example.com'); // 2 USDC

      const status = budget.getStatus();
      expect(status.totalSpent).toBe('3.00 USDC');
      expect(status.paymentCount).toBe(2);
    });

    it('should trigger budget warning at 80%', () => {
      const budget = new BudgetManager({ maxTotal: '10.00' });
      const warningFn = vi.fn();
      budget.onBudgetWarning = warningFn;

      // Spend 8 USDC (80% of 10)
      budget.recordSpend('8000000', 'item-1', 'example.com');
      expect(warningFn).toHaveBeenCalledTimes(1);
      expect(warningFn).toHaveBeenCalledWith(expect.stringContaining('2.00'));
    });

    it('should not trigger warning before 80%', () => {
      const budget = new BudgetManager({ maxTotal: '10.00' });
      const warningFn = vi.fn();
      budget.onBudgetWarning = warningFn;

      budget.recordSpend('7000000', 'item-1', 'example.com'); // 70%
      expect(warningFn).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should show unlimited when no limits set', () => {
      const budget = new BudgetManager();
      const status = budget.getStatus();
      expect(status.perRequest).toBe('unlimited');
      expect(status.totalRemaining).toBe('unlimited');
      expect(status.totalSpent).toBe('0.00 USDC');
      expect(status.paymentCount).toBe(0);
    });

    it('should show correct remaining budget', () => {
      const budget = new BudgetManager({
        maxPerRequest: '2.00',
        maxTotal: '100.00',
      });

      budget.recordSpend('5000000', 'item-1', 'example.com'); // 5 USDC

      const status = budget.getStatus();
      expect(status.perRequest).toBe('2.00 USDC');
      expect(status.totalRemaining).toBe('95.00 USDC');
      expect(status.totalSpent).toBe('5.00 USDC');
      expect(status.paymentCount).toBe(1);
    });
  });

  describe('getRemainingSmallest', () => {
    it('should return null when no total limit', () => {
      const budget = new BudgetManager();
      expect(budget.getRemainingSmallest()).toBeNull();
    });

    it('should return remaining amount in smallest unit', () => {
      const budget = new BudgetManager({ maxTotal: '10.00' });
      budget.recordSpend('3000000', 'item-1', 'example.com');
      expect(budget.getRemainingSmallest()).toBe('7000000');
    });
  });

  describe('getHistory', () => {
    it('should return empty array initially', () => {
      const budget = new BudgetManager();
      expect(budget.getHistory()).toHaveLength(0);
    });

    it('should track payment records', () => {
      const budget = new BudgetManager();
      budget.recordSpend('1000000', 'article-1', 'api.example.com');

      const history = budget.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].contentId).toBe('article-1');
      expect(history[0].amount).toBe('1000000');
      expect(history[0].domain).toBe('api.example.com');
      expect(history[0].timestamp).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should clear all spending data', () => {
      const budget = new BudgetManager({ maxTotal: '10.00' });
      budget.recordSpend('5000000', 'item-1', 'example.com');

      budget.reset();

      const status = budget.getStatus();
      expect(status.totalSpent).toBe('0.00 USDC');
      expect(status.paymentCount).toBe(0);
      expect(budget.getHistory()).toHaveLength(0);
    });
  });

  describe('assertSpend', () => {
    it('should not throw when spend is allowed', () => {
      const budget = new BudgetManager({ maxPerRequest: '5.00' });
      expect(() => budget.assertSpend('1.00')).not.toThrow();
    });

    it('should throw X402BudgetError for per-request limit', () => {
      const budget = new BudgetManager({ maxPerRequest: '1.00' });
      expect(() => budget.assertSpend('2.00')).toThrow(X402BudgetError);
    });

    it('should throw with PER_REQUEST_LIMIT code', () => {
      const budget = new BudgetManager({ maxPerRequest: '1.00' });
      try {
        budget.assertSpend('2.00');
      } catch (err) {
        expect(err).toBeInstanceOf(X402BudgetError);
        expect((err as X402BudgetError).code).toBe('PER_REQUEST_LIMIT');
      }
    });

    it('should throw with DOMAIN_NOT_ALLOWED code', () => {
      const budget = new BudgetManager({ allowedDomains: ['good.com'] });
      try {
        budget.assertSpend('1.00', 'evil.com');
      } catch (err) {
        expect(err).toBeInstanceOf(X402BudgetError);
        expect((err as X402BudgetError).code).toBe('DOMAIN_NOT_ALLOWED');
      }
    });

    it('should throw with BUDGET_EXCEEDED code for total limit', () => {
      const budget = new BudgetManager({ maxTotal: '5.00' });
      budget.recordSpend('4000000', 'item-1', 'example.com');

      try {
        budget.assertSpend('2.00');
      } catch (err) {
        expect(err).toBeInstanceOf(X402BudgetError);
        expect((err as X402BudgetError).code).toBe('BUDGET_EXCEEDED');
      }
    });
  });
});
