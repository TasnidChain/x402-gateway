/**
 * Tests for EIP-712 utilities
 */

import { describe, it, expect } from 'vitest';
import {
  buildUSDCDomain,
  generateNonce,
  buildTransferAuthorization,
  EIP712_TYPES,
} from './eip712';

describe('EIP-712 utilities', () => {
  describe('EIP712_TYPES', () => {
    it('should define TransferWithAuthorization types', () => {
      expect(EIP712_TYPES.TransferWithAuthorization).toHaveLength(6);
      const names = EIP712_TYPES.TransferWithAuthorization.map((t) => t.name);
      expect(names).toEqual(['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce']);
    });

    it('should use correct Solidity types', () => {
      const types = EIP712_TYPES.TransferWithAuthorization;
      expect(types[0]).toEqual({ name: 'from', type: 'address' });
      expect(types[1]).toEqual({ name: 'to', type: 'address' });
      expect(types[2]).toEqual({ name: 'value', type: 'uint256' });
      expect(types[3]).toEqual({ name: 'validAfter', type: 'uint256' });
      expect(types[4]).toEqual({ name: 'validBefore', type: 'uint256' });
      expect(types[5]).toEqual({ name: 'nonce', type: 'bytes32' });
    });
  });

  describe('buildUSDCDomain', () => {
    it('should build domain for base-mainnet', () => {
      const domain = buildUSDCDomain('base-mainnet');
      expect(domain).toEqual({
        name: 'USD Coin',
        version: '2',
        chainId: 8453,
        verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      });
    });

    it('should build domain for base-sepolia', () => {
      const domain = buildUSDCDomain('base-sepolia');
      expect(domain).toEqual({
        name: 'USD Coin',
        version: '2',
        chainId: 84532,
        verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      });
    });
  });

  describe('generateNonce', () => {
    it('should generate a 32-byte hex nonce', () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set(Array.from({ length: 10 }, () => generateNonce()));
      expect(nonces.size).toBe(10);
    });

    it('should start with 0x prefix', () => {
      const nonce = generateNonce();
      expect(nonce.startsWith('0x')).toBe(true);
    });
  });

  describe('buildTransferAuthorization', () => {
    const defaultParams = {
      from: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      to: '0x0987654321098765432109876543210987654321' as `0x${string}`,
      price: '0.01',
      network: 'base-mainnet' as const,
    };

    it('should build complete typed data', () => {
      const { typedData, authorization } = buildTransferAuthorization(defaultParams);

      // Check domain
      expect(typedData.domain.name).toBe('USD Coin');
      expect(typedData.domain.version).toBe('2');
      expect(typedData.domain.chainId).toBe(8453);

      // Check types
      expect(typedData.types).toBe(EIP712_TYPES);

      // Check primary type
      expect(typedData.primaryType).toBe('TransferWithAuthorization');

      // Check message
      expect(typedData.message.from).toBe(defaultParams.from);
      expect(typedData.message.to).toBe(defaultParams.to);
      expect(typedData.message.value).toBe('10000'); // 0.01 * 10^6
    });

    it('should convert price to smallest unit', () => {
      const { typedData } = buildTransferAuthorization({
        ...defaultParams,
        price: '1.50',
      });
      expect(typedData.message.value).toBe('1500000'); // 1.50 * 10^6
    });

    it('should default validAfter to 0', () => {
      const { typedData } = buildTransferAuthorization(defaultParams);
      expect(typedData.message.validAfter).toBe(0);
    });

    it('should default validBefore to ~1 hour from now', () => {
      const before = Math.floor(Date.now() / 1000) + 3600;
      const { typedData } = buildTransferAuthorization(defaultParams);
      // Should be within 5 seconds of expected
      expect(Math.abs(typedData.message.validBefore - before)).toBeLessThan(5);
    });

    it('should accept custom validAfter and validBefore', () => {
      const { typedData } = buildTransferAuthorization({
        ...defaultParams,
        validAfter: 1000,
        validBefore: 9999,
      });
      expect(typedData.message.validAfter).toBe(1000);
      expect(typedData.message.validBefore).toBe(9999);
    });

    it('should accept custom nonce', () => {
      const customNonce = '0x' + 'ab'.repeat(32) as `0x${string}`;
      const { typedData } = buildTransferAuthorization({
        ...defaultParams,
        nonce: customNonce,
      });
      expect(typedData.message.nonce).toBe(customNonce);
    });

    it('should generate nonce if not provided', () => {
      const { typedData } = buildTransferAuthorization(defaultParams);
      expect(typedData.message.nonce).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should return matching authorization object', () => {
      const { typedData, authorization } = buildTransferAuthorization(defaultParams);
      expect(authorization.from).toBe(typedData.message.from);
      expect(authorization.to).toBe(typedData.message.to);
      expect(authorization.value).toBe(typedData.message.value);
      expect(authorization.validAfter).toBe(typedData.message.validAfter);
      expect(authorization.validBefore).toBe(typedData.message.validBefore);
      expect(authorization.nonce).toBe(typedData.message.nonce);
    });

    it('should use base-sepolia contract for testnet', () => {
      const { typedData } = buildTransferAuthorization({
        ...defaultParams,
        network: 'base-sepolia',
      });
      expect(typedData.domain.chainId).toBe(84532);
      expect(typedData.domain.verifyingContract).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
    });
  });
});
