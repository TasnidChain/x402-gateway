/**
 * @x402/core - Pricing Utilities
 * Price formatting, parsing, and validation for USDC payments
 */

import { USDC_DECIMALS, MIN_PRICE_USDC } from './constants';

/**
 * Parse a price string or number into the smallest unit (6 decimals for USDC)
 *
 * @param price - Price in various formats: "$0.01", "0.01", 0.01
 * @returns Price in smallest unit as string (e.g., "10000" for $0.01)
 *
 * @example
 * parsePrice("$0.01") // "10000"
 * parsePrice("0.01")  // "10000"
 * parsePrice(0.01)    // "10000"
 * parsePrice("1.00")  // "1000000"
 */
export function parsePrice(price: string | number): string {
  let numericPrice: number;

  if (typeof price === 'string') {
    // Remove currency symbol if present
    const cleanPrice = price.replace(/^\$/, '').trim();
    numericPrice = parseFloat(cleanPrice);
  } else {
    numericPrice = price;
  }

  if (isNaN(numericPrice) || numericPrice < 0) {
    throw new Error(`Invalid price: ${price}`);
  }

  // Convert to smallest unit (multiply by 10^6 for USDC)
  const multiplier = Math.pow(10, USDC_DECIMALS);
  const smallestUnit = Math.round(numericPrice * multiplier);

  return smallestUnit.toString();
}

/**
 * Format a price from smallest unit to human-readable string
 *
 * @param amount - Amount in smallest unit (e.g., "10000" for $0.01)
 * @param options - Formatting options
 * @returns Formatted price string (e.g., "$0.01")
 *
 * @example
 * formatPrice("10000")    // "$0.01"
 * formatPrice("1000000")  // "$1.00"
 * formatPrice("10000", { symbol: false }) // "0.01"
 */
export function formatPrice(
  amount: string | number,
  options: {
    /** Include currency symbol (default: true) */
    symbol?: boolean;
    /** Number of decimal places (default: 2, up to 6) */
    decimals?: number;
  } = {}
): string {
  const { symbol = true, decimals = 2 } = options;

  const numericAmount = typeof amount === 'string' ? parseInt(amount, 10) : amount;

  if (isNaN(numericAmount) || numericAmount < 0) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  // Convert from smallest unit
  const divisor = Math.pow(10, USDC_DECIMALS);
  const price = numericAmount / divisor;

  // Format with specified decimals
  const formatted = price.toFixed(Math.min(decimals, USDC_DECIMALS));

  return symbol ? `$${formatted}` : formatted;
}

/**
 * Validate a price value
 *
 * @param price - Price to validate (any format)
 * @returns Validation result with parsed amount
 */
export function validatePrice(price: string | number): {
  valid: boolean;
  amount?: string;
  error?: string;
} {
  try {
    const amount = parsePrice(price);
    const minAmount = parsePrice(MIN_PRICE_USDC);

    if (BigInt(amount) < BigInt(minAmount)) {
      return {
        valid: false,
        error: `Price must be at least ${MIN_PRICE_USDC} USDC`,
      };
    }

    return {
      valid: true,
      amount,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid price',
    };
  }
}

/**
 * Compare two prices
 *
 * @param a - First price (any format)
 * @param b - Second price (any format)
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function comparePrice(a: string | number, b: string | number): -1 | 0 | 1 {
  const amountA = BigInt(parsePrice(a));
  const amountB = BigInt(parsePrice(b));

  if (amountA < amountB) return -1;
  if (amountA > amountB) return 1;
  return 0;
}

/**
 * Add two prices together
 *
 * @param a - First price (any format)
 * @param b - Second price (any format)
 * @returns Sum in smallest unit as string
 */
export function addPrices(a: string | number, b: string | number): string {
  const amountA = BigInt(parsePrice(a));
  const amountB = BigInt(parsePrice(b));
  return (amountA + amountB).toString();
}

/**
 * Calculate percentage of a price
 *
 * @param price - Base price (any format)
 * @param percentage - Percentage as decimal (e.g., 0.1 for 10%)
 * @returns Result in smallest unit as string
 */
export function percentageOfPrice(price: string | number, percentage: number): string {
  const amount = BigInt(parsePrice(price));
  // Use integer math to avoid floating point issues
  const percentBasis = BigInt(Math.round(percentage * 10000));
  return ((amount * percentBasis) / BigInt(10000)).toString();
}
