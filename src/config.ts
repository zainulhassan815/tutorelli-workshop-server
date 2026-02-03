function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined) return fallback;
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return num;
}

export const config = {
  port: getEnvNumber('PORT', 3000),
  ghl: {
    apiBaseUrl: getEnv('GHL_API_BASE_URL', 'https://services.leadconnectorhq.com'),
    accessToken: getEnv('GHL_ACCESS_TOKEN'),
    locationId: getEnv('GHL_LOCATION_ID'),
    bookingWebhookUrl: process.env.GHL_BOOKING_WEBHOOK_URL,
  },
  schemas: {
    workshopOfferings: getEnv('WORKSHOP_OFFERINGS_SCHEMA'),
    bookings: getEnv('BOOKINGS_SCHEMA'),
  },
  checkoutBaseUrl: getEnv('CHECKOUT_BASE_URL'),
  stripe: {
    secretKey: getEnv('STRIPE_SECRET_KEY'),
    publishableKey: getEnv('STRIPE_PUBLISHABLE_KEY'),
    webhookSecret: getEnv('STRIPE_WEBHOOK_SECRET'),
    currency: getEnv('STRIPE_CURRENCY', 'gbp'),
    successUrl: getEnv('CHECKOUT_SUCCESS_URL'),
  },
  request: {
    timeoutMs: 15000,
    maxRetries: 2,
    pageLimit: 100,
  },
} as const;

export type Config = typeof config;
