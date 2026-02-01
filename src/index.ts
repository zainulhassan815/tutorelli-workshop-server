import { config } from './config';
import {
  handleHealth,
  handleGetOfferings,
  handleCreateBooking,
  handleNotFound,
  handleMethodNotAllowed,
} from './handlers';
import {
  handleCreateCheckoutSession,
  handleStripeWebhook,
} from './stripe-handlers';

function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function handleCorsPreflightRequest(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function router(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Route matching
  if (path === '/api/health' && method === 'GET') {
    return handleHealth();
  }

  if (path === '/api/offerings') {
    if (method === 'GET') return handleGetOfferings(request);
    return handleMethodNotAllowed();
  }

  if (path === '/api/bookings') {
    if (method === 'POST') return handleCreateBooking(request);
    return handleMethodNotAllowed();
  }

  if (path === '/api/checkout/session') {
    if (method === 'POST') return handleCreateCheckoutSession(request);
    return handleMethodNotAllowed();
  }

  if (path === '/api/webhooks/stripe') {
    if (method === 'POST') return handleStripeWebhook(request);
    return handleMethodNotAllowed();
  }

  return handleNotFound();
}

function log(request: Request, response: Response, durationMs: number): void {
  const timestamp = new Date().toISOString();
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname + url.search;
  const status = response.status;

  console.log(`[${timestamp}] ${method} ${path} ${status} ${durationMs}ms`);
}

const server = Bun.serve({
  port: config.port,

  async fetch(request: Request): Promise<Response> {
    const startTime = Date.now();

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPreflightRequest();
    }

    try {
      const response = await router(request);
      const responseWithCors = addCorsHeaders(response);
      const durationMs = Date.now() - startTime;
      log(request, responseWithCors, durationMs);
      return responseWithCors;
    } catch (error) {
      console.error('Unhandled error:', error);
      const errorResponse = new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const responseWithCors = addCorsHeaders(errorResponse);
      const durationMs = Date.now() - startTime;
      log(request, responseWithCors, durationMs);
      return responseWithCors;
    }
  },
});

console.log(`Workshop Booking API running on http://localhost:${server.port}`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  server.stop();
  process.exit(0);
});
