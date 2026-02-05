import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { resolveNetwork, verifySignature, validateTimeWindow } from '../src/signature';
import { USDC_ADDRESSES, EIP712_TYPES } from '@x402/core';
import type { TransferAuthorization } from '@x402/core';

// Test private key (DO NOT use in production)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const account = privateKeyToAccount(TEST_PRIVATE_KEY);

describe('resolveNetwork', () => {
  it('resolves base-mainnet', () => {
    const result = resolveNetwork('eip155:8453');
    expect(result).toEqual({ x402Network: 'base-mainnet', chainId: 8453 });
  });

  it('resolves base-sepolia', () => {
    const result = resolveNetwork('eip155:84532');
    expect(result).toEqual({ x402Network: 'base-sepolia', chainId: 84532 });
  });

  it('returns null for unsupported network', () => {
    expect(resolveNetwork('eip155:1')).toBeNull();
    expect(resolveNetwork('invalid')).toBeNull();
  });
});

describe('verifySignature', () => {
  const authorization: TransferAuthorization = {
    from: account.address,
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    value: '10000',
    validAfter: 0,
    validBefore: 9999999999,
    nonce: '0x' + '01'.repeat(32) as `0x${string}`,
  };

  async function signAuthorization(auth: TransferAuthorization, chainId: number, network: 'base-mainnet' | 'base-sepolia') {
    return account.signTypedData({
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: BigInt(chainId),
        verifyingContract: USDC_ADDRESSES[network],
      },
      types: EIP712_TYPES,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: auth.from,
        to: auth.to,
        value: BigInt(auth.value),
        validAfter: BigInt(auth.validAfter),
        validBefore: BigInt(auth.validBefore),
        nonce: auth.nonce,
      },
    });
  }

  it('validates a correct signature on base-mainnet', async () => {
    const signature = await signAuthorization(authorization, 8453, 'base-mainnet');
    const result = await verifySignature(authorization, signature, 8453, 'base-mainnet');

    expect(result.valid).toBe(true);
    expect(result.recoveredAddress.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it('validates a correct signature on base-sepolia', async () => {
    const signature = await signAuthorization(authorization, 84532, 'base-sepolia');
    const result = await verifySignature(authorization, signature, 84532, 'base-sepolia');

    expect(result.valid).toBe(true);
  });

  it('rejects a signature with wrong from address', async () => {
    const signature = await signAuthorization(authorization, 8453, 'base-mainnet');
    const tampered = { ...authorization, from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}` };
    const result = await verifySignature(tampered, signature, 8453, 'base-mainnet');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Signature mismatch');
  });

  it('rejects an invalid signature', async () => {
    const badSig = '0x' + 'ab'.repeat(65) as `0x${string}`;
    const result = await verifySignature(authorization, badSig, 8453, 'base-mainnet');

    expect(result.valid).toBe(false);
  });
});

describe('validateTimeWindow', () => {
  it('accepts a valid time window', () => {
    const auth: TransferAuthorization = {
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      value: '1000',
      validAfter: 0,
      validBefore: Math.floor(Date.now() / 1000) + 3600,
      nonce: '0x' + '00'.repeat(32) as `0x${string}`,
    };
    expect(validateTimeWindow(auth).valid).toBe(true);
  });

  it('rejects expired authorization', () => {
    const auth: TransferAuthorization = {
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      value: '1000',
      validAfter: 0,
      validBefore: Math.floor(Date.now() / 1000) - 100,
      nonce: '0x' + '00'.repeat(32) as `0x${string}`,
    };
    const result = validateTimeWindow(auth);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('rejects not-yet-valid authorization', () => {
    const auth: TransferAuthorization = {
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      value: '1000',
      validAfter: Math.floor(Date.now() / 1000) + 9999,
      validBefore: Math.floor(Date.now() / 1000) + 99999,
      nonce: '0x' + '00'.repeat(32) as `0x${string}`,
    };
    const result = validateTimeWindow(auth);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not yet valid');
  });
});
