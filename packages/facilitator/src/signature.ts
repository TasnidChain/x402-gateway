/**
 * @x402/facilitator - Signature Verification
 * Recovers and validates EIP-712 signatures for USDC transferWithAuthorization
 */

import { recoverTypedDataAddress } from 'viem';
import type { TransferAuthorization } from '@x402/core';
import { USDC_ADDRESSES, NUMERIC_CHAIN_IDS, EIP712_TYPES } from '@x402/core';
import type { X402Network } from '@x402/core';

/**
 * Resolve a CAIP-2 network string to X402Network identifier
 *
 * @param network - CAIP-2 network (e.g., "eip155:8453")
 * @returns X402Network or null if unsupported
 */
export function resolveNetwork(network: string): { x402Network: X402Network; chainId: number } | null {
  for (const [name, id] of Object.entries(NUMERIC_CHAIN_IDS)) {
    if (network === `eip155:${id}`) {
      return { x402Network: name as X402Network, chainId: id };
    }
  }
  return null;
}

/**
 * Build the EIP-712 domain for USDC on a specific chain
 */
function buildDomain(chainId: number, x402Network: X402Network) {
  return {
    name: 'USD Coin' as const,
    version: '2' as const,
    chainId: BigInt(chainId),
    verifyingContract: USDC_ADDRESSES[x402Network],
  };
}

/**
 * Recover the signer address from an EIP-712 TransferWithAuthorization signature
 *
 * @param authorization - The transfer authorization parameters
 * @param signature - The EIP-712 signature
 * @param chainId - Numeric chain ID
 * @param x402Network - Network identifier for looking up USDC contract
 * @returns Recovered signer address
 */
export async function recoverSigner(
  authorization: TransferAuthorization,
  signature: `0x${string}`,
  chainId: number,
  x402Network: X402Network
): Promise<`0x${string}`> {
  const domain = buildDomain(chainId, x402Network);

  const recovered = await recoverTypedDataAddress({
    domain,
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
    signature,
  });

  return recovered;
}

/**
 * Verify that an EIP-712 signature is valid for the given authorization
 *
 * @returns Object with valid flag and recovered address
 */
export async function verifySignature(
  authorization: TransferAuthorization,
  signature: `0x${string}`,
  chainId: number,
  x402Network: X402Network
): Promise<{ valid: boolean; recoveredAddress: `0x${string}`; error?: string }> {
  try {
    const recovered = await recoverSigner(authorization, signature, chainId, x402Network);
    const fromNormalized = authorization.from.toLowerCase();
    const recoveredNormalized = recovered.toLowerCase();

    if (fromNormalized !== recoveredNormalized) {
      return {
        valid: false,
        recoveredAddress: recovered,
        error: `Signature mismatch: expected ${authorization.from}, recovered ${recovered}`,
      };
    }

    return { valid: true, recoveredAddress: recovered };
  } catch (err) {
    return {
      valid: false,
      recoveredAddress: '0x0000000000000000000000000000000000000000',
      error: `Signature recovery failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validate the time window of a transfer authorization
 */
export function validateTimeWindow(authorization: TransferAuthorization): { valid: boolean; error?: string } {
  const now = Math.floor(Date.now() / 1000);

  if (authorization.validBefore <= now) {
    return { valid: false, error: `Authorization expired: validBefore ${authorization.validBefore} <= now ${now}` };
  }

  if (authorization.validAfter > now) {
    return { valid: false, error: `Authorization not yet valid: validAfter ${authorization.validAfter} > now ${now}` };
  }

  return { valid: true };
}
