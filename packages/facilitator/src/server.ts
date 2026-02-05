/**
 * @x402/facilitator - HTTP Server
 * Minimal HTTP server using Node built-in http module
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { FacilitatorConfig } from './config';
import type { TransferExecutor } from './types';
import { handlePayment } from './handler';

/**
 * Set CORS headers on the response
 */
function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-402-Receipt, X-PAYMENT');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Read the full request body as a string
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Send a JSON response
 */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Create and start the facilitator HTTP server
 */
export function startServer(config: FacilitatorConfig, executor: TransferExecutor): void {
  const server = createServer(async (req, res) => {
    setCorsHeaders(res);

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '/';

    // Health check
    if (req.method === 'GET' && (url === '/health' || url === '/')) {
      sendJson(res, 200, {
        status: 'ok',
        service: '@x402/facilitator',
        version: '0.1.0',
        mockMode: config.mockTransfers,
      });
      return;
    }

    // Payment endpoint — accept POST to / or /facilitator
    if (req.method === 'POST' && (url === '/' || url === '/facilitator')) {
      try {
        const bodyStr = await readBody(req);
        let body: unknown;

        try {
          body = JSON.parse(bodyStr);
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON in request body' });
          return;
        }

        const result = await handlePayment(body, config, executor);
        sendJson(res, result.status, result.body);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error('[facilitator] Unhandled error:', err);
        sendJson(res, 500, { error: message });
      }
      return;
    }

    // 404 for everything else
    sendJson(res, 404, { error: 'Not found' });
  });

  server.listen(config.port, () => {
    console.log(`[x402/facilitator] Running on port ${config.port}`);
    console.log(`[x402/facilitator] Mock mode: ${config.mockTransfers}`);
    console.log(`[x402/facilitator] Fee: ${config.feePercent}%`);
    console.log(`[x402/facilitator] URL: ${config.facilitatorUrl}`);
  });
}
