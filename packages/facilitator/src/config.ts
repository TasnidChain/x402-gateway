/**
 * @x402/facilitator - Configuration
 * Loads and validates environment variables
 */

export interface FacilitatorConfig {
  port: number;
  jwtSecret: string;
  feePercent: number;
  facilitatorUrl: string;
  mockTransfers: boolean;
  facilitatorPrivateKey?: `0x${string}`;
  rpcUrl?: string;
}

export function loadConfig(): FacilitatorConfig {
  const port = parseInt(process.env.PORT || '4020', 10);
  const jwtSecret = process.env.JWT_SECRET || '';
  const feePercent = parseFloat(process.env.FEE_PERCENT || '2');
  const facilitatorUrl = process.env.FACILITATOR_URL || `http://localhost:${port}`;
  const mockTransfers = process.env.MOCK_TRANSFERS !== 'false';
  const facilitatorPrivateKey = process.env.FACILITATOR_PRIVATE_KEY as `0x${string}` | undefined;
  const rpcUrl = process.env.RPC_URL;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  if (feePercent < 0 || feePercent > 50) {
    throw new Error('FEE_PERCENT must be between 0 and 50');
  }

  if (!mockTransfers && !facilitatorPrivateKey) {
    throw new Error('FACILITATOR_PRIVATE_KEY is required when MOCK_TRANSFERS=false');
  }

  return {
    port,
    jwtSecret,
    feePercent,
    facilitatorUrl,
    mockTransfers,
    facilitatorPrivateKey,
    rpcUrl,
  };
}
