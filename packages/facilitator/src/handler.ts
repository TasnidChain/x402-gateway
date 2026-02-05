/**
 * @x402/facilitator - Request Handler
 * Processes payment requests: validate → verify signature → execute transfer → return receipt
 */

import type { FacilitatorPayload } from '@x402/core';
import { buildReceipt, createReceiptToken } from '@x402/core';
import type { FacilitatorConfig } from './config';
import type { TransferExecutor } from './types';
import { resolveNetwork, verifySignature, validateTimeWindow } from './signature';
import { calculateFee } from './fee';

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Handle a facilitator payment request
 *
 * Full flow:
 * 1. Parse & validate payload
 * 2. Resolve network
 * 3. Verify EIP-712 signature
 * 4. Validate time window
 * 5. Calculate fee
 * 6. Execute transfer
 * 7. Build & sign receipt
 * 8. Return receipt + txHash
 */
export async function handlePayment(
  payload: unknown,
  config: FacilitatorConfig,
  executor: TransferExecutor
): Promise<HandlerResult> {
  // 1. Validate payload structure
  const validation = validatePayload(payload);
  if (!validation.valid) {
    return { status: 400, body: { error: validation.error } };
  }
  const request = validation.payload!;

  // 2. Resolve network
  const networkInfo = resolveNetwork(request.network);
  if (!networkInfo) {
    return { status: 400, body: { error: `Unsupported network: ${request.network}` } };
  }

  const { authorization } = request.payload;
  const signature = request.payload.signature;

  // 3. Verify EIP-712 signature
  const sigResult = await verifySignature(
    authorization,
    signature,
    networkInfo.chainId,
    networkInfo.x402Network
  );
  if (!sigResult.valid) {
    return { status: 400, body: { error: sigResult.error } };
  }

  // 4. Validate time window
  const timeResult = validateTimeWindow(authorization);
  if (!timeResult.valid) {
    return { status: 400, body: { error: timeResult.error } };
  }

  // 5. Calculate fee
  const fees = calculateFee(authorization.value, config.feePercent);

  // 6. Execute transfer
  let txHash: `0x${string}`;
  try {
    const transferResult = await executor.execute({
      authorization,
      signature,
      chainId: networkInfo.chainId,
    });

    if (!transferResult.success) {
      return { status: 500, body: { error: 'Transfer execution failed' } };
    }

    txHash = transferResult.txHash;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown transfer error';
    return { status: 500, body: { error: `Transfer failed: ${message}` } };
  }

  // 7. Build & sign receipt
  const receipt = buildReceipt({
    contentId: request.resource,
    payer: authorization.from,
    payee: authorization.to,
    amount: fees.publisherAmount,
    currency: 'USDC',
    txHash,
    chainId: networkInfo.chainId,
    facilitator: config.facilitatorUrl,
  });

  const receiptToken = await createReceiptToken(receipt, config.jwtSecret);

  // 8. Return receipt
  return {
    status: 200,
    body: { receipt: receiptToken, txHash },
  };
}

/**
 * Validate the shape of a FacilitatorPayload
 */
function validatePayload(body: unknown): { valid: boolean; payload?: FacilitatorPayload; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const obj = body as Record<string, unknown>;

  if (obj.x402Version !== 1) {
    return { valid: false, error: `Unsupported x402Version: ${obj.x402Version}. Expected 1` };
  }

  if (obj.scheme !== 'exact') {
    return { valid: false, error: `Unsupported scheme: ${obj.scheme}. Expected "exact"` };
  }

  if (typeof obj.network !== 'string') {
    return { valid: false, error: 'Missing or invalid network field' };
  }

  if (typeof obj.resource !== 'string') {
    return { valid: false, error: 'Missing or invalid resource field' };
  }

  const payload = obj.payload as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Missing payload field' };
  }

  if (typeof payload.signature !== 'string' || !payload.signature.startsWith('0x')) {
    return { valid: false, error: 'Missing or invalid payload.signature' };
  }

  const auth = payload.authorization as Record<string, unknown> | undefined;
  if (!auth || typeof auth !== 'object') {
    return { valid: false, error: 'Missing payload.authorization' };
  }

  const requiredFields = ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce'] as const;
  for (const field of requiredFields) {
    if (auth[field] === undefined || auth[field] === null) {
      return { valid: false, error: `Missing payload.authorization.${field}` };
    }
  }

  if (typeof auth.from !== 'string' || !auth.from.startsWith('0x')) {
    return { valid: false, error: 'Invalid authorization.from address' };
  }

  if (typeof auth.to !== 'string' || !auth.to.startsWith('0x')) {
    return { valid: false, error: 'Invalid authorization.to address' };
  }

  if (typeof auth.nonce !== 'string' || !auth.nonce.startsWith('0x')) {
    return { valid: false, error: 'Invalid authorization.nonce' };
  }

  return { valid: true, payload: body as FacilitatorPayload };
}
