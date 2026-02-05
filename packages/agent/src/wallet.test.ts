/**
 * Tests for agent wallet
 */

import { describe, it, expect } from 'vitest';
import { createAgentWallet } from './wallet';

// Known test private key (DO NOT use in production)
// This is the standard test private key from Hardhat/Foundry
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`;
const EXPECTED_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('agent wallet', () => {
  describe('createAgentWallet', () => {
    it('should derive correct address from private key', () => {
      const wallet = createAgentWallet(TEST_PRIVATE_KEY, 'base-mainnet');
      expect(wallet.address.toLowerCase()).toBe(EXPECTED_ADDRESS.toLowerCase());
    });

    it('should work with base-sepolia network', () => {
      const wallet = createAgentWallet(TEST_PRIVATE_KEY, 'base-sepolia');
      expect(wallet.address.toLowerCase()).toBe(EXPECTED_ADDRESS.toLowerCase());
    });

    it('should have signTypedData method', () => {
      const wallet = createAgentWallet(TEST_PRIVATE_KEY, 'base-mainnet');
      expect(typeof wallet.signTypedData).toBe('function');
    });

    it('should have getBalance method', () => {
      const wallet = createAgentWallet(TEST_PRIVATE_KEY, 'base-mainnet');
      expect(typeof wallet.getBalance).toBe('function');
    });

    it('should sign EIP-712 typed data', async () => {
      const wallet = createAgentWallet(TEST_PRIVATE_KEY, 'base-mainnet');

      const signature = await wallet.signTypedData({
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 8453,
          verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        message: {
          from: wallet.address,
          to: '0x0987654321098765432109876543210987654321',
          value: '10000',
          validAfter: 0,
          validBefore: 9999999999,
          nonce: '0x' + 'ab'.repeat(32),
        },
      });

      // Should be a valid hex signature (65 bytes = 130 hex chars + 0x prefix)
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });

    it('should produce deterministic signatures', async () => {
      const wallet = createAgentWallet(TEST_PRIVATE_KEY, 'base-mainnet');

      const params = {
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 8453,
          verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        message: {
          from: wallet.address,
          to: '0x0987654321098765432109876543210987654321',
          value: '10000',
        },
      };

      const sig1 = await wallet.signTypedData(params);
      const sig2 = await wallet.signTypedData(params);

      expect(sig1).toBe(sig2);
    });
  });
});
