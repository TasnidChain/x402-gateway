import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { handlePayment } from '../src/handler';
import { USDC_ADDRESSES, EIP712_TYPES, verifyReceipt } from '@x402/core';
import type { FacilitatorConfig } from '../src/config';
import type { TransferExecutor, TransferResult } from '../src/types';
import type { TransferAuthorization } from '@x402/core';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const account = privateKeyToAccount(TEST_PRIVATE_KEY);
const PAYEE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;

const TEST_CONFIG: FacilitatorConfig = {
  port: 4020,
  jwtSecret: 'test-secret-for-unit-tests',
  feePercent: 2,
  facilitatorUrl: 'http://localhost:4020',
  mockTransfers: true,
};

const MOCK_TX_HASH = '0x0000000000000000000000000000000000000000000000000000000000000001' as const;

const mockExecutor: TransferExecutor = {
  async execute(): Promise<TransferResult> {
    return { txHash: MOCK_TX_HASH, success: true };
  },
};

const failingExecutor: TransferExecutor = {
  async execute(): Promise<TransferResult> {
    return { txHash: '0x' + '00'.repeat(32) as `0x${string}`, success: false };
  },
};

async function buildValidPayload() {
  const authorization: TransferAuthorization = {
    from: account.address,
    to: PAYEE,
    value: '100000', // $0.10
    validAfter: 0,
    validBefore: 9999999999,
    nonce: '0x' + 'ab'.repeat(32) as `0x${string}`,
  };

  const signature = await account.signTypedData({
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: BigInt(8453),
      verifyingContract: USDC_ADDRESSES['base-mainnet'],
    },
    types: EIP712_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  });

  return {
    x402Version: 1,
    scheme: 'exact',
    network: 'eip155:8453',
    payload: { signature, authorization },
    resource: 'test-article-1',
  };
}

describe('handlePayment', () => {
  it('processes a valid payment and returns a receipt', async () => {
    const payload = await buildValidPayload();
    const result = await handlePayment(payload, TEST_CONFIG, mockExecutor);

    expect(result.status).toBe(200);
    expect(result.body.receipt).toBeDefined();
    expect(result.body.txHash).toBe(MOCK_TX_HASH);

    // Verify the receipt is a valid JWT
    const verification = await verifyReceipt(result.body.receipt as string, {
      jwtSecret: TEST_CONFIG.jwtSecret,
      expectedContentId: 'test-article-1',
    });
    expect(verification.valid).toBe(true);
    expect(verification.receipt?.payer.toLowerCase()).toBe(account.address.toLowerCase());
    expect(verification.receipt?.payee.toLowerCase()).toBe(PAYEE.toLowerCase());
    // Publisher amount after 2% fee: 100000 - 2000 = 98000
    expect(verification.receipt?.amount).toBe('98000');
  });

  it('rejects invalid JSON payload', async () => {
    const result = await handlePayment(null, TEST_CONFIG, mockExecutor);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('JSON object');
  });

  it('rejects wrong x402Version', async () => {
    const payload = await buildValidPayload();
    const result = await handlePayment({ ...payload, x402Version: 2 }, TEST_CONFIG, mockExecutor);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('x402Version');
  });

  it('rejects unsupported network', async () => {
    const payload = await buildValidPayload();
    const result = await handlePayment({ ...payload, network: 'eip155:1' }, TEST_CONFIG, mockExecutor);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Unsupported network');
  });

  it('rejects tampered signature', async () => {
    const payload = await buildValidPayload();
    // Change the to address after signing
    payload.payload.authorization.to = '0x0000000000000000000000000000000000000001';
    const result = await handlePayment(payload, TEST_CONFIG, mockExecutor);
    expect(result.status).toBe(400);
  });

  it('returns 500 when transfer executor fails', async () => {
    const payload = await buildValidPayload();
    const result = await handlePayment(payload, TEST_CONFIG, failingExecutor);
    expect(result.status).toBe(500);
    expect(result.body.error).toContain('Transfer execution failed');
  });

  it('rejects missing payload.signature', async () => {
    const result = await handlePayment({
      x402Version: 1,
      scheme: 'exact',
      network: 'eip155:8453',
      payload: { authorization: {} },
      resource: 'test',
    }, TEST_CONFIG, mockExecutor);
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('signature');
  });

  it('rejects missing authorization fields', async () => {
    const result = await handlePayment({
      x402Version: 1,
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        signature: '0x' + 'aa'.repeat(65),
        authorization: { from: '0xabc' },
      },
      resource: 'test',
    }, TEST_CONFIG, mockExecutor);
    expect(result.status).toBe(400);
  });
});
