/**
 * @x402/facilitator - Fee Calculation
 * Computes facilitator fee and publisher payout from payment amount
 */

import type { FeeBreakdown } from './types';

/**
 * Calculate fee breakdown for a payment
 *
 * @param amount - Payment amount in smallest unit (e.g., "10000" for $0.01 USDC)
 * @param feePercent - Fee percentage (e.g., 2 for 2%)
 * @returns Fee breakdown with publisher and facilitator amounts
 *
 * @example
 * const fees = calculateFee("100000", 2);
 * // { totalAmount: "100000", publisherAmount: "98000", feeAmount: "2000", feePercent: 2 }
 */
export function calculateFee(amount: string, feePercent: number): FeeBreakdown {
  const total = BigInt(amount);
  const feeBps = BigInt(Math.round(feePercent * 100)); // Convert percent to basis points
  const fee = (total * feeBps) / 10000n;
  const publisherAmount = total - fee;

  return {
    totalAmount: amount,
    publisherAmount: publisherAmount.toString(),
    feeAmount: fee.toString(),
    feePercent,
  };
}
